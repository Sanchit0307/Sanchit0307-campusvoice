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
  'Rejected',
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

  // Helper to seed a notification document
  async function seedNotification(notifId = 'notif_1', overrideData = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db.collection('notifications').doc(notifId).set({
        recipientId: 'student_123',
        ideaId: 'idea_1',
        ideaTitle: 'Renovate Library Study Spaces',
        type: 'idea_status_changed',
        message: 'Your idea "Renovate Library Study Spaces" is now under review.',
        previousStatus: 'Submitted',
        newStatus: 'Under Review',
        isRead: false,
        createdAt: Timestamp.now(),
        ...overrideData,
      })
    })
  }

  // Helper to seed a status history document
  async function seedStatusHistory(ideaId = 'idea_1', historyId = 'hist_1', overrideData = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db
        .collection('ideas')
        .doc(ideaId)
        .collection('statusHistory')
        .doc(historyId)
        .set({
          ideaId,
          previousStatus: 'Submitted',
          newStatus: 'Under Review',
          changedAt: Timestamp.now(),
          changedBy: 'mod_123',
          description: 'Status changed from Submitted to Under Review',
          ...overrideData,
        })
    })
  }

  // Helper to seed a user profile document
  async function seedUserProfile(userId = 'student_123', overrideData = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await db.collection('users').doc(userId).set({
        uid: userId,
        displayName: 'Alex Student',
        email: 'alex@campus.edu',
        bio: 'Computer science major enthusiastic about campus sustainability.',
        department: 'Computer Science',
        year: 'Junior',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...overrideData,
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

    it('3b. User with capitalized role "Moderator" or field "Role" can update and delete ideas', async () => {
      await seedIdea('idea_alias_1')
      await seedIdea('idea_alias_2')
      await seedModerator('mod_cap', 'Moderator')
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('moderators').doc('mod_field').set({ Role: 'moderator' })
      })

      const modCapDb = testEnv.authenticatedContext('mod_cap').firestore()
      const modFieldDb = testEnv.authenticatedContext('mod_field').firestore()

      await assertSucceeds(
        modCapDb.collection('ideas').doc('idea_alias_1').delete()
      )

      await assertSucceeds(
        modFieldDb.collection('ideas').doc('idea_alias_2').delete()
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
    it('5. Moderator cannot set an invalid status such as Archived or Deleted', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Archived',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        modDb.collection('ideas').doc('idea_1').update({
          status: 'Deleted',
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

    it('5b. Moderator can reject an idea; ordinary student cannot', async () => {
      await seedIdea('idea_reject')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Student cannot reject an idea
      await assertFails(
        studentDb.collection('ideas').doc('idea_reject').update({
          status: 'Rejected',
          updatedAt: serverTimestamp(),
        })
      )

      // Authorized moderator can reject an idea
      await assertSucceeds(
        modDb.collection('ideas').doc('idea_reject').update({
          status: 'Rejected',
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
    it('12. Only authorized moderators can delete an idea; denied for guests, authors, and students', async () => {
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

      // Authorized moderator CAN delete
      await assertSucceeds(modDb.collection('ideas').doc('idea_1').delete())
    })

    it('12b. Authorized moderator can remove vote documents under an idea; ordinary students cannot delete another user vote', async () => {
      await seedIdea('idea_votes')
      await seedVote('idea_votes', 'voter_1')
      await seedModerator('mod_123', 'moderator')

      const studentDb = testEnv.authenticatedContext('student_2').firestore()
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Ordinary student cannot delete another user's vote
      await assertFails(
        studentDb.collection('ideas').doc('idea_votes').collection('votes').doc('voter_1').delete()
      )

      // Authorized moderator CAN delete the vote document during idea cleanup
      await assertSucceeds(
        modDb.collection('ideas').doc('idea_votes').collection('votes').doc('voter_1').delete()
      )
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

  // =========================================================================
  // Requirement 20: Notifications Collection Security
  // =========================================================================
  describe('Notifications Collection Security', () => {
    it('20a. Authenticated student can read only their own notifications', async () => {
      await seedNotification('notif_student_123', { recipientId: 'student_123' })

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const docSnap = await assertSucceeds(
        studentDb.collection('notifications').doc('notif_student_123').get()
      )
      assert.equal(docSnap.exists, true)
    })

    it('20b. Authenticated student cannot read another student\'s notification', async () => {
      await seedNotification('notif_student_123', { recipientId: 'student_123' })

      const otherStudentDb = testEnv.authenticatedContext('other_student_456').firestore()
      await assertFails(
        otherStudentDb.collection('notifications').doc('notif_student_123').get()
      )
    })

    it('20c. Unauthenticated visitor cannot read notifications', async () => {
      await seedNotification('notif_student_123', { recipientId: 'student_123' })

      const guestDb = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        guestDb.collection('notifications').doc('notif_student_123').get()
      )
    })

    it('20d. Authenticated student can mark their own notification as read', async () => {
      await seedNotification('notif_read_test', { recipientId: 'student_123', isRead: false })

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      await assertSucceeds(
        studentDb.collection('notifications').doc('notif_read_test').update({
          isRead: true,
        })
      )
    })

    it('20e. Authenticated student cannot modify immutable fields (e.g., recipientId or message)', async () => {
      await seedNotification('notif_immutable', { recipientId: 'student_123', isRead: false })

      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Cannot change message
      await assertFails(
        studentDb.collection('notifications').doc('notif_immutable').update({
          message: 'Tampered notification message',
        })
      )

      // Cannot reassign recipientId
      await assertFails(
        studentDb.collection('notifications').doc('notif_immutable').update({
          recipientId: 'someone_else',
          isRead: true,
        })
      )

      // Cannot change ideaId
      await assertFails(
        studentDb.collection('notifications').doc('notif_immutable').update({
          ideaId: 'idea_tampered',
          isRead: true,
        })
      )
    })

    it('20f. Authenticated student cannot mark another student\'s notification as read', async () => {
      await seedNotification('notif_victim', { recipientId: 'victim_student', isRead: false })

      const attackerDb = testEnv.authenticatedContext('attacker_student').firestore()
      await assertFails(
        attackerDb.collection('notifications').doc('notif_victim').update({
          isRead: true,
        })
      )
    })

    it('20g. Ordinary student cannot create notifications (forgery defense)', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_1',
          ideaTitle: 'Renovate Library Study Spaces',
          type: 'idea_status_changed',
          message: 'Forged status notification',
          previousStatus: 'Submitted',
          newStatus: 'Approved',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })

    it('20h. Authorized moderator can create legitimate notification matching schema', async () => {
      await seedIdea('idea_1', { authorId: 'student_123', title: 'Renovate Library Study Spaces' })
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertSucceeds(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_1',
          ideaTitle: 'Renovate Library Study Spaces',
          type: 'idea_status_changed',
          message: 'Your idea "Renovate Library Study Spaces" has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Accepted',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })

    it('20i. Moderator cannot create notification with invalid schema', async () => {
      await seedIdea('idea_1', { authorId: 'student_123', title: 'Renovate Library Study Spaces' })
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Invalid status
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_1',
          ideaTitle: 'Renovate Library Study Spaces',
          type: 'idea_status_changed',
          message: 'Your idea has been archived.',
          previousStatus: 'Under Review',
          newStatus: 'Archived',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )

      // Missing required field 'newStatus'
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_1',
          ideaTitle: 'Renovate Library Study Spaces',
          type: 'idea_status_changed',
          message: 'Your idea has been approved.',
          previousStatus: 'Under Review',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )

      // Extra unexpected field
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_1',
          ideaTitle: 'Renovate Library Study Spaces',
          type: 'idea_status_changed',
          message: 'Your idea has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Accepted',
          isRead: false,
          createdAt: serverTimestamp(),
          extraForgedField: 'injected payload',
        })
      )
    })

    it('20j. Authenticated student can delete their own notification, but not another student\'s notification', async () => {
      await seedNotification('notif_to_delete', { recipientId: 'student_123' })

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const otherDb = testEnv.authenticatedContext('other_student').firestore()

      // Other student cannot delete
      await assertFails(otherDb.collection('notifications').doc('notif_to_delete').delete())

      // Recipient student can delete
      await assertSucceeds(studentDb.collection('notifications').doc('notif_to_delete').delete())
    })

    it('20k. Moderator cannot create notification for a non-existent idea document', async () => {
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Idea 'ghost_idea' does NOT exist
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'ghost_idea',
          ideaTitle: 'Non-Existent Proposal',
          type: 'idea_status_changed',
          message: 'Your idea "Non-Existent Proposal" has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Accepted',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })

    it('20l. Moderator cannot create notification where recipientId does not match idea authorId', async () => {
      await seedIdea('idea_real', { authorId: 'legitimate_author', title: 'Solar Panels on Gym' })
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Trying to target 'innocent_victim' instead of 'legitimate_author'
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'innocent_victim',
          ideaId: 'idea_real',
          ideaTitle: 'Solar Panels on Gym',
          type: 'idea_status_changed',
          message: 'Your idea "Solar Panels on Gym" has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Accepted',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })

    it('20m. Moderator cannot create notification with forged idea title that mismatches the actual idea', async () => {
      await seedIdea('idea_real', { authorId: 'student_123', title: 'Real Proposal Title' })
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Trying to put forged title 'Forged Fake Title'
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_real',
          ideaTitle: 'Forged Fake Title',
          type: 'idea_status_changed',
          message: 'Your idea "Forged Fake Title" has been approved.',
          previousStatus: 'Under Review',
          newStatus: 'Accepted',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })

    it('20n. Moderator cannot create notification when previousStatus equals newStatus (unchanged)', async () => {
      await seedIdea('idea_real', { authorId: 'student_123', title: 'Real Proposal Title' })
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // previousStatus === newStatus ('Under Review' == 'Under Review')
      await assertFails(
        modDb.collection('notifications').add({
          recipientId: 'student_123',
          ideaId: 'idea_real',
          ideaTitle: 'Real Proposal Title',
          type: 'idea_status_changed',
          message: 'Your idea "Real Proposal Title" is now under review.',
          previousStatus: 'Under Review',
          newStatus: 'Under Review',
          isRead: false,
          createdAt: serverTimestamp(),
        })
      )
    })
  })

  // =========================================================================
  // Requirement 21: Status History Subcollection Security (ideas/{ideaId}/statusHistory)
  // =========================================================================
  describe('Status History Subcollection Security (ideas/{ideaId}/statusHistory)', () => {
    it('21a. Unauthenticated visitor and authenticated student can read statusHistory subcollection', async () => {
      await seedIdea('idea_1')
      await seedStatusHistory('idea_1', 'hist_1')

      const guestDb = testEnv.unauthenticatedContext().firestore()
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertSucceeds(
        guestDb.collection('ideas').doc('idea_1').collection('statusHistory').doc('hist_1').get()
      )
      await assertSucceeds(
        studentDb.collection('ideas').doc('idea_1').collection('statusHistory').doc('hist_1').get()
      )
    })

    it('21b. Authorized moderator can create legitimate status transition history event', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertSucceeds(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
            description: 'Status changed from Submitted to Under Review',
          })
      )
    })

    it('21c. Ordinary student cannot create status transition history event (forgery defense)', async () => {
      await seedIdea('idea_1')
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Accepted',
            changedAt: serverTimestamp(),
            changedBy: 'student_123',
            description: 'Forged status promotion',
          })
      )
    })

    it('21d. Unauthenticated visitor cannot create status transition history event', async () => {
      await seedIdea('idea_1')
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertFails(
        guestDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: null,
            description: 'Unauthenticated status transition',
          })
      )
    })

    it('21e. Legitimate atomic idea-plus-history creation succeeds for authenticated user', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const batch = studentDb.batch()
      const ideaRef = studentDb.collection('ideas').doc('idea_atomic_auth')
      const historyRef = ideaRef.collection('statusHistory').doc('idea_atomic_auth_init')

      batch.set(ideaRef, {
        title: 'Renovate Library Study Spaces',
        description: 'Add more power outlets and ergonomic chairs to the second floor study rooms.',
        category: 'Facilities',
        authorId: 'student_123',
        authorName: 'Alex Student',
        status: 'Submitted',
        upvoteCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(historyRef, {
        ideaId: 'idea_atomic_auth',
        previousStatus: null,
        newStatus: 'Submitted',
        changedAt: serverTimestamp(),
        changedBy: 'student_123',
        description: 'Proposal submitted',
      })

      await assertSucceeds(batch.commit())
    })

    it('21f. Legitimate atomic idea-plus-history creation succeeds for unauthenticated visitor', async () => {
      const guestDb = testEnv.unauthenticatedContext().firestore()
      const batch = guestDb.batch()
      const ideaRef = guestDb.collection('ideas').doc('idea_atomic_anon')
      const historyRef = ideaRef.collection('statusHistory').doc('idea_atomic_anon_init')

      batch.set(ideaRef, {
        title: 'Outdoor Solar Charging Stations',
        description: 'Install weatherproof solar benches across the central campus quad for charging devices.',
        category: 'Sustainability',
        authorId: null,
        authorName: 'Anonymous Student',
        status: 'Submitted',
        upvoteCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(historyRef, {
        ideaId: 'idea_atomic_anon',
        previousStatus: null,
        newStatus: 'Submitted',
        changedAt: serverTimestamp(),
        changedBy: null,
        description: 'Proposal submitted',
      })

      await assertSucceeds(batch.commit())
    })

    it('21g. Cannot append a fabricated initial history event to an existing idea (authenticated student)', async () => {
      await seedIdea('idea_existing_auth', { authorId: 'student_123' })
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_existing_auth')
          .collection('statusHistory')
          .doc('fabricated_init')
          .set({
            ideaId: 'idea_existing_auth',
            previousStatus: null,
            newStatus: 'Submitted',
            changedAt: serverTimestamp(),
            changedBy: 'student_123',
            description: 'Fabricated initial history on existing idea',
          })
      )
    })

    it('21h. Cannot append a fabricated initial history event to an existing idea (unauthenticated visitor)', async () => {
      await seedIdea('idea_existing_anon', { authorId: null })
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertFails(
        guestDb
          .collection('ideas')
          .doc('idea_existing_anon')
          .collection('statusHistory')
          .doc('fabricated_init_anon')
          .set({
            ideaId: 'idea_existing_anon',
            previousStatus: null,
            newStatus: 'Submitted',
            changedAt: serverTimestamp(),
            changedBy: null,
            description: 'Fabricated initial history on existing idea',
          })
      )
    })

    it('21i. Atomic creation fails if initial history changedBy mismatches parent idea authorId', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const batch = studentDb.batch()
      const ideaRef = studentDb.collection('ideas').doc('idea_mismatch_author')
      const historyRef = ideaRef.collection('statusHistory').doc('idea_mismatch_author_init')

      batch.set(ideaRef, {
        title: 'Renovate Library Study Spaces',
        description: 'Add more power outlets and ergonomic chairs to the second floor study rooms.',
        category: 'Facilities',
        authorId: 'student_123',
        authorName: 'Alex Student',
        status: 'Submitted',
        upvoteCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(historyRef, {
        ideaId: 'idea_mismatch_author',
        previousStatus: null,
        newStatus: 'Submitted',
        changedAt: serverTimestamp(),
        changedBy: 'other_student_999',
        description: 'Proposal submitted',
      })

      await assertFails(batch.commit())
    })

    it('21j. Atomic creation fails if initial history newStatus is other than "Submitted"', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const batch = studentDb.batch()
      const ideaRef = studentDb.collection('ideas').doc('idea_bad_status')
      const historyRef = ideaRef.collection('statusHistory').doc('idea_bad_status_init')

      batch.set(ideaRef, {
        title: 'Renovate Library Study Spaces',
        description: 'Add more power outlets and ergonomic chairs to the second floor study rooms.',
        category: 'Facilities',
        authorId: 'student_123',
        authorName: 'Alex Student',
        status: 'Submitted',
        upvoteCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(historyRef, {
        ideaId: 'idea_bad_status',
        previousStatus: null,
        newStatus: 'Accepted',
        changedAt: serverTimestamp(),
        changedBy: 'student_123',
        description: 'Forged instant acceptance',
      })

      await assertFails(batch.commit())
    })

    it('21k. Initial history event cannot be created for a non-existent parent idea without creating it atomically', async () => {
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      await assertFails(
        studentDb
          .collection('ideas')
          .doc('ghost_idea')
          .collection('statusHistory')
          .doc('ghost_idea_init')
          .set({
            ideaId: 'ghost_idea',
            previousStatus: null,
            newStatus: 'Submitted',
            changedAt: serverTimestamp(),
            changedBy: 'student_123',
            description: 'Proposal submitted for ghost idea',
          })
      )
    })

    it('21l. Moderator cannot create status transition history event where previousStatus equals newStatus', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // previousStatus === newStatus ('Under Review' == 'Under Review')
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Under Review',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
            description: 'Duplicate unchanged status event',
          })
      )
    })

    it('21m. Moderator cannot spoof changedBy (must match authenticated UID)', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Trying to claim another moderator or student made the change
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'In Progress',
            changedAt: serverTimestamp(),
            changedBy: 'other_admin_999',
            description: 'Status changed from Submitted to In Progress',
          })
      )
    })

    it('21n. Client cannot supply arbitrary past or future timestamp (must match serverTimestamp)', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Future timestamp
      const futureTime = Timestamp.fromDate(new Date(Date.now() + 86400000))
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: futureTime,
            changedBy: 'mod_123',
            description: 'Status changed from Submitted to Under Review',
          })
      )
    })

    it('21o. Moderator cannot create history event with non-canonical status', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'FastTracked',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
            description: 'Status changed from Submitted to FastTracked',
          })
      )
    })

    it('21p. History events are strictly immutable: updates denied for both moderator and student', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      await seedStatusHistory('idea_1', 'hist_immutable')

      const modDb = testEnv.authenticatedContext('mod_123').firestore()
      const studentDb = testEnv.authenticatedContext('student_123').firestore()

      // Update denied for student
      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .doc('hist_immutable')
          .update({
            description: 'Tampered description',
          })
      )

      // Update denied even for moderator
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .doc('hist_immutable')
          .update({
            description: 'Tampered description by moderator',
          })
      )
    })

    it('21q. Ordinary student cannot delete history events, but authorized moderator can delete for cleanup', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      await seedStatusHistory('idea_1', 'hist_to_delete')

      const studentDb = testEnv.authenticatedContext('student_123').firestore()
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Student cannot delete
      await assertFails(
        studentDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .doc('hist_to_delete')
          .delete()
      )

      // Moderator can delete (e.g. cascading removal)
      await assertSucceeds(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .doc('hist_to_delete')
          .delete()
      )
    })

    it('21r. History event rejects mismatched ideaId (must match parent doc ID)', async () => {
      await seedIdea('idea_parent')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_parent')
          .collection('statusHistory')
          .add({
            ideaId: 'mismatched_ghost_id',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
            description: 'Mismatched ideaId',
          })
      )
    })

    it('21s. History event rejects missing required fields or extra unexpected fields', async () => {
      await seedIdea('idea_1')
      await seedModerator('mod_123', 'moderator')
      const modDb = testEnv.authenticatedContext('mod_123').firestore()

      // Missing description
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
          })
      )

      // Extra unexpected field
      await assertFails(
        modDb
          .collection('ideas')
          .doc('idea_1')
          .collection('statusHistory')
          .add({
            ideaId: 'idea_1',
            previousStatus: 'Submitted',
            newStatus: 'Under Review',
            changedAt: serverTimestamp(),
            changedBy: 'mod_123',
            description: 'Status changed from Submitted to Under Review',
            injectedExtraKey: 'malicious payload',
          })
      )
    })
  })

  // =========================================================================
  // Requirement 22: User Profiles Collection Security (users/{userId})
  // =========================================================================
  describe('User Profiles Collection Security (users/{userId})', () => {
    it('22a. Authenticated student can read their own permitted profile', async () => {
      await seedUserProfile('student_alex')
      const studentDb = testEnv.authenticatedContext('student_alex').firestore()

      await assertSucceeds(studentDb.collection('users').doc('student_alex').get())
    })

    it('22b. Authenticated student CANNOT read another student\'s private profile', async () => {
      await seedUserProfile('student_bob')
      const studentDb = testEnv.authenticatedContext('student_alex').firestore()

      await assertFails(studentDb.collection('users').doc('student_bob').get())
    })

    it('22c. Unauthenticated visitor CANNOT read any profile document', async () => {
      await seedUserProfile('student_alex')
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertFails(guestDb.collection('users').doc('student_alex').get())
    })

    it('22d. Authenticated student can create their own profile document with valid fields', async () => {
      const studentDb = testEnv.authenticatedContext('student_create').firestore()

      await assertSucceeds(
        studentDb.collection('users').doc('student_create').set({
          uid: 'student_create',
          displayName: 'Jordan Student',
          email: 'jordan@campus.edu',
          bio: 'Campus advocate.',
          department: 'Environmental Studies',
          year: 'Senior',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22e. Authenticated student CANNOT create a profile for another user UID (UID spoofing)', async () => {
      const studentDb = testEnv.authenticatedContext('student_attacker').firestore()

      await assertFails(
        studentDb.collection('users').doc('victim_uid').set({
          uid: 'victim_uid',
          displayName: 'Spoofed User',
          email: 'victim@campus.edu',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22f. Authenticated student CANNOT inject role or unpermitted fields during profile creation', async () => {
      const studentDb = testEnv.authenticatedContext('student_escalate').firestore()

      await assertFails(
        studentDb.collection('users').doc('student_escalate').set({
          uid: 'student_escalate',
          displayName: 'Escalation Attempt',
          email: 'escalate@campus.edu',
          role: 'moderator',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22g. Authenticated student CANNOT create profile with invalid display name length', async () => {
      const studentDb = testEnv.authenticatedContext('student_short').firestore()

      // Too short (1 char < 2 chars required)
      await assertFails(
        studentDb.collection('users').doc('student_short').set({
          uid: 'student_short',
          displayName: 'A',
          email: 'short@campus.edu',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22h. Authenticated student can update permitted fields on their own profile', async () => {
      await seedUserProfile('student_editor')
      const studentDb = testEnv.authenticatedContext('student_editor').firestore()

      await assertSucceeds(
        studentDb.collection('users').doc('student_editor').update({
          displayName: 'Alex Updated',
          bio: 'Updated bio information.',
          department: 'Data Science',
          year: 'Senior',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22i. Authenticated student CANNOT update another student\'s profile', async () => {
      await seedUserProfile('student_victim')
      const attackerDb = testEnv.authenticatedContext('student_attacker').firestore()

      await assertFails(
        attackerDb.collection('users').doc('student_victim').update({
          bio: 'Hacked bio',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22j. Authenticated student CANNOT modify protected fields (uid, email, createdAt, role) during update', async () => {
      await seedUserProfile('student_tamper')
      const studentDb = testEnv.authenticatedContext('student_tamper').firestore()

      // Attempting to modify email
      await assertFails(
        studentDb.collection('users').doc('student_tamper').update({
          email: 'hacked_email@other.edu',
          updatedAt: serverTimestamp(),
        })
      )

      // Attempting to inject role
      await assertFails(
        studentDb.collection('users').doc('student_tamper').update({
          role: 'moderator',
          updatedAt: serverTimestamp(),
        })
      )

      // Attempting to alter uid
      await assertFails(
        studentDb.collection('users').doc('student_tamper').update({
          uid: 'other_uid',
          updatedAt: serverTimestamp(),
        })
      )
    })

    it('22k. Authenticated student CANNOT delete their profile document', async () => {
      await seedUserProfile('student_delete')
      const studentDb = testEnv.authenticatedContext('student_delete').firestore()

      await assertFails(
        studentDb.collection('users').doc('student_delete').delete()
      )
    })

    it('22l. Unauthenticated visitor CANNOT create or update any profile document', async () => {
      await seedUserProfile('student_target')
      const guestDb = testEnv.unauthenticatedContext().firestore()

      await assertFails(
        guestDb.collection('users').doc('student_target').update({
          bio: 'Anonymous update',
          updatedAt: serverTimestamp(),
        })
      )

      await assertFails(
        guestDb.collection('users').doc('new_ghost').set({
          uid: 'new_ghost',
          displayName: 'Guest Ghost',
          email: 'ghost@campus.edu',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    })
  })
})
