import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { serverTimestamp, Timestamp } from 'firebase/firestore'
import fs from 'node:fs'

const CANONICAL_STATUSES = [
  'Submitted',
  'Under Review',
  'In Progress',
  'Accepted',
  'Implemented',
]

const VALID_IDEA_FIXTURE = {
  title: 'Renovate Library Study Spaces',
  description: 'Add more power outlets and ergonomic chairs to the second floor study rooms.',
  category: 'Facilities',
  authorId: 'student_123',
  authorName: 'Alex Student',
  status: 'Submitted',
  upvoteCount: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}

describe('Firestore Security Rules Suite', () => {
  let testEnv

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-campusvoice-rules-test',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    })
  })

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  // Helper to seed an existing idea document with security rules bypassed
  async function seedIdea(ideaId = 'idea_1', overrideData = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db.collection('ideas').doc(ideaId).set({
        ...VALID_IDEA_FIXTURE,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...overrideData,
      })
    })
  }

  // Helper to seed a moderator document
  async function seedModerator(userId = 'mod_123', role = 'moderator') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db.collection('moderators').doc(userId).set({ role })
    })
  }

  // Helper to seed a vote document
  async function seedVote(ideaId = 'idea_1', voterId = 'student_123') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db
        .collection('ideas')
        .doc(ideaId)
        .collection('votes')
        .doc(voterId)
        .set({
          userId: voterId,
          createdAt: Timestamp.now(),
        })
    })
  }

  // =========================================================================
  // Requirement 1 & 2: Status updates denied for unauthenticated & ordinary users
  // =========================================================================
  describe('Idea Status Updates — Authorization Controls', () => {
    it('1. Unauthenticated visitor cannot update an idea status', async () => {
      await seedIdea('idea_1')
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertFails(
        guestDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('2. Authenticated student without a moderator document cannot update an idea status', async () => {
      await seedIdea('idea_1')
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('2b. Authenticated user with non-moderator role cannot update idea status', async () => {
      await seedIdea('idea_1')
      await seedModerator('admin_user', 'admin') // Not 'moderator'
      const userDb = testEnv.authenticatedContext('admin_user').firestore()

      await assertFails(
        userDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: serverTimestamp(),
        })
      )
    })

    // =========================================================================
    // Requirement 3 & 4: Valid status transitions by authorized moderators
    // =========================================================================
    it('3. User with valid moderator document can update idea to Under Review', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertSucceeds(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('4. Moderator can update idea to each other valid canonical status', async () => {
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      for (const targetStatus of CANONICAL_STATUSES) {
        await seedIdea('idea_target', { status: 'Submitted' })
        // If targetStatus is 'Submitted', start from 'Under Review' so there is a status diff
        if (targetStatus === 'Submitted') {
          await seedIdea('idea_target', { status: 'Under Review' })
        }

        await assertSucceeds(
          modDb.collection('ideas').doc('idea_target').update({
            status: targetStatus,
            updatedAt: serverTimestamp(),
          })
        )
      }
    })

    // =========================================================================
    // Requirement 5: Non-canonical status values are rejected
    // =========================================================================
    it('5. Moderator cannot set an invalid status such as Rejected or Archived', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Rejected',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Archived',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Pending',
          updatedAt: serverTimestamp(),
        })
      )
    })

    // =========================================================================
    // Requirements 6, 7, 8, 9: Protected fields cannot be modified
    // =========================================================================
    it('6. Moderator cannot change the title while updating status', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          title: 'Tampered Idea Title',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('7. Moderator cannot directly change upvoteCount', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          upvoteCount: 999,
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('8. Moderator cannot reassign authorId', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          authorId: 'different_student_uid',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('9. Moderator cannot change description, category, authorName, or createdAt', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          description: 'Replaced description text here with modified content',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          category: 'Dining',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          authorName: 'Forged Author Name',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          createdAt: Timestamp.now(),
          updatedAt: serverTimestamp(),
        })
      )
    })
  })

  // =========================================================================
  // Requirement 10 & 11: Moderators collection protection & read permissions
  // =========================================================================
  describe('Moderators Collection Security', () => {
    it('10. Client cannot create, modify, or delete moderator documents (privilege escalation defense)', async () => {
      await seedModerator('existing_mod', 'moderator')

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const modDb = testEnv.authenticatedContext('existing_mod').firestore()
      const guestDb = testEnv.unauthenticatedContext().firestore()

      // 10a. Student cannot self-grant moderator privileges
      await assertFails(
        studentDb.collection('moderators').doc('student_123').set({
          role: 'moderator',
        })
      )

      // 10b. Student cannot modify existing moderator document
      await assertFails(
        studentDb.collection('moderators').doc('existing_mod').update({
          role: 'student',
        })
      )

      // 10c. Student cannot delete moderator document
      await assertFails(
        studentDb.collection('moderators').doc('existing_mod').delete()
      )

      // 10d. Existing moderator cannot create other moderators from client
      await assertFails(
        modDb.collection('moderators').doc('new_mod').set({
          role: 'moderator',
        })
      )

      // 10e. Guest cannot create moderator document
      await assertFails(
        guestDb.collection('moderators').doc('guest_escalate').set({
          role: 'moderator',
        })
      )
    })

    it('11. Authenticated user can read moderator document; unauthenticated visitor cannot', async () => {
      await seedModerator('mod_123', 'moderator')

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const guestDb = testEnv.unauthenticatedContext().firestore()

      // Authenticated student can read moderator document to check role
      await assertSucceeds(
        studentDb.collection('moderators').doc('mod_123').get()
      )

      // Unauthenticated visitor is denied reading moderator documents
      await assertFails(
        guestDb.collection('moderators').doc('mod_123').get()
      )
    })
  })

  // =========================================================================
  // Requirement 12: Idea deletion denied for all clients
  // =========================================================================
  describe('Idea Deletion Security', () => {
    it('12. Clients cannot delete an idea (unauthenticated, author, or moderator)', async () => {
      await seedIdea('idea_1', { authorId: 'student_123' })
      await seedModerator('mod_123', 'moderator')

      const guestDb = testEnv.unauthenticatedContext().firestore()
      const authorDb = testEnv.authenticatedContext('student_123').firestore()
      const otherStudentDb = testEnv.authenticatedContext('other_456').firestore()
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Unauthenticated client cannot delete
      await assertFails(guestDb.collection('ideas').doc('idea_1').delete())

      // Original author cannot delete
      await assertFails(authorDb.collection('ideas').doc('idea_1').delete())

      // Other student cannot delete
      await assertFails(otherStudentDb.collection('ideas').doc('idea_1').delete())

      // Moderator cannot delete
      await assertFails(modDb.collection('ideas').doc('idea_1').delete())
    })
  })

  // =========================================================================
  // Requirements 13, 14, 15, 16: Votes subcollection rules
  // =========================================================================
  describe('Votes Subcollection Authorization & Integrity', () => {
    it('13. Student cannot create a vote for another user UID', async () => {
      await seedIdea('idea_1')
      const attackerDb = testEnv.authenticatedContext('attacker_uid').firestore()

      await assertFails(
        attackerDb
          .collection('ideas')
          .doc('idea_1')
          .collection('votes')
          .doc('victim_uid')
          .set({
            userId: 'victim_uid',
            createdAt: serverTimestamp(),
          })
      )
    })

    it('14. User can create their own valid vote document', async () => {
      await seedIdea('idea_1')
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertSucceeds(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('votes')
          .doc('student_123')
          .set({
            userId: 'student_123',
            createdAt: serverTimestamp(),
          })
      )
    })

    it('15. User cannot modify an existing vote document', async () => {
      await seedIdea('idea_1')
      await seedVote('idea_1', 'student_123')

      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('votes')
          .doc('student_123')
          .update({
            createdAt: serverTimestamp(),
          })
      )
    })

    it('16. User can delete their own vote, but cannot delete another user vote', async () => {
      await seedIdea('idea_1')
      await seedVote('idea_1', 'student_123')
      await seedVote('idea_1', 'other_user')

      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Cannot delete another user's vote document
      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('votes')
          .doc('other_user')
          .delete()
      )

      // Can delete own vote document (toggle unvote)
      await assertSucceeds(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('votes')
          .doc('student_123')
          .delete()
      )
    })
  })

  // =========================================================================
  // Requirement 17: Idea creation schema validation constraints
  // =========================================================================
  describe('Idea Creation Schema Validation (isValidIdea)', () => {
    it('17a. Valid proposal creation succeeds for authenticated user', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertSucceeds(
        studentDb.collection('ideas').add({
          title: 'Solar Powered Charging Stations',
          description: 'Install solar-powered outdoor charging benches across campus quads.',
          category: 'Sustainability',
          authorId: 'student_123',
          authorName: 'Student Name',
          status: 'Submitted',
          upvoteCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17b. Valid proposal creation succeeds with null authorId (anonymous submission)', async () => {
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertSucceeds(
        guestDb.collection('ideas').add({
          title: 'Water Bottle Refill Station in Gym',
          description: 'Install touchless filtered water bottle refill units inside the gym facility.',
          category: 'Facilities',
          authorId: null,
          authorName: 'Anonymous Student',
          status: 'Submitted',
          upvoteCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17c. Rejects idea missing required fields', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Missing category
      await assertFails(
        studentDb.collection('ideas').add({
          title: 'Solar Powered Charging Stations',
          description: 'Install solar-powered outdoor charging benches across campus quads.',
          authorId: 'student_123',
          authorName: 'Student Name',
          status: 'Submitted',
          upvoteCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17d. Rejects idea with extra unexpected fields', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          extraInjectedField: 'malicious payload',
        })
      )
    })

    it('17e. Rejects title shorter than 5 characters or longer than 100 characters', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Title too short (<5 chars)
      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          title: 'Tiny',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )

      // Title too long (>100 chars)
      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          title: 'A'.repeat(101),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17f. Rejects description shorter than 20 characters or longer than 500 characters', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Description too short (<20 chars)
      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          description: 'Too short desc.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )

      // Description too long (>500 chars)
      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          description: 'A'.repeat(501),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17g. Rejects invalid category outside canonical list', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          category: 'Secret Category',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17h. Rejects initial status other than Submitted', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          status: 'Accepted',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17i. Rejects non-zero initial upvoteCount', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          upvoteCount: 50,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('17j. Rejects authorName shorter than 2 characters or longer than 100 characters', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          authorName: 'X',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        studentDb.collection('ideas').add({
          ...VALID_IDEA_FIXTURE,
          authorName: 'A'.repeat(101),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })
  })

  // =========================================================================
  // Requirement 18: Public and authenticated read permissions
  // =========================================================================
  describe('Read Permissions for Ideas and Votes', () => {
    it('18a. Unauthenticated visitor and authenticated user can read ideas collection and documents', async () => {
      await seedIdea('idea_1')

      const guestDb = testEnv.unauthenticatedContext().firestore()
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Guest can read idea doc
      const guestSnap = await assertSucceeds(guestDb.collection('ideas').doc('idea_1').get())
      assert.equal(guestSnap.exists, true)

      // Guest can read ideas collection query
      const guestList = await assertSucceeds(guestDb.collection('ideas').get())
      assert.equal(guestList.docs.length, 1)

      // Authenticated student can read idea doc
      const studentSnap = await assertSucceeds(studentDb.collection('ideas').doc('idea_1').get())
      assert.equal(studentSnap.exists, true)

      // Authenticated student can read ideas collection query
      const studentList = await assertSucceeds(studentDb.collection('ideas').get())
      assert.equal(studentList.docs.length, 1)
    })

    it('18b. Unauthenticated visitor and authenticated user can read votes subcollection', async () => {
      await seedIdea('idea_1')
      await seedVote('idea_1', 'student_123')

      const guestDb = testEnv.unauthenticatedContext().firestore()
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Guest can read vote document
      const guestVoteSnap = await assertSucceeds(
        guestDb.collection('ideas').doc('idea_1').collection('votes').doc('student_123').get()
      )
      assert.equal(guestVoteSnap.exists, true)

      // Guest can read votes collection
      const guestVotesList = await assertSucceeds(
        guestDb.collection('ideas').doc('idea_1').collection('votes').get()
      )
      assert.equal(guestVotesList.docs.length, 1)

      // Authenticated student can read vote document
      const studentVoteSnap = await assertSucceeds(
        studentDb.collection('ideas').doc('idea_1').collection('votes').doc('student_123').get()
      )
      assert.equal(studentVoteSnap.exists, true)

      // Authenticated student can read votes collection
      const studentVotesList = await assertSucceeds(
        studentDb.collection('ideas').doc('idea_1').collection('votes').get()
      )
      assert.equal(studentVotesList.docs.length, 1)
    })
  })

  // =========================================================================
  // Requirement 4 (Timestamp Security): Server timestamp vs arbitrary client timestamps
  // =========================================================================
  describe('Timestamp Integrity & Manipulation Defense', () => {
    it('19a. Legitimate moderator update with serverTimestamp succeeds', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertSucceeds(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('19b. Client cannot supply arbitrary future timestamp during status update', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Fake future timestamp (year 2099)
      const arbitraryFutureDate = new Date('2099-01-01T00:00:00Z')
      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: arbitraryFutureDate,
        })
      )
    })

    it('19c. Client cannot supply arbitrary past timestamp during status update', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Fake past timestamp (epoch year 2000)
      const arbitraryPastDate = new Date('2000-01-01T00:00:00Z')
      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Under Review',
          updatedAt: arbitraryPastDate,
        })
      )
    })
  })
})
