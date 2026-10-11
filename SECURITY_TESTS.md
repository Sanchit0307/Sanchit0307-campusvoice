# Security Rules Test Matrix & Verification: Issue #8 Phase 2 (Moderation)

This document formalizes the security test matrix, verification results, timestamp vulnerability analysis, and privacy evaluation for Cloud Firestore Security Rules governing `ideas`, `moderators`, and the `votes` subcollections in CampusVoice.

---

## 1. Automated Test Matrix & Results

All 32 test scenarios below are automated in `tests/rules/firestore.rules.test.js` and executed against the local Firestore Emulator via `npm run test:rules`.

| # | Test Scenario / Requirement | Actor / Context | Target Path | Operation & Payload | Expected Result | Enforcing Rule | Status |
|---|-----------------------------|-----------------|-------------|---------------------|-----------------|----------------|--------|
| **1** | Unauthenticated visitor attempts status update | Unauthenticated (`request.auth == null`) | `ideas/idea_1` | `update { status: "Under Review", updatedAt }` | **PERMISSION DENIED** | `isAuthenticated()` fails | **PASSED** |
| **2** | Authenticated student without moderator doc attempts status update | Auth user (`student_123`, no mod doc) | `ideas/idea_1` | `update { status: "Under Review", updatedAt }` | **PERMISSION DENIED** | `isModerator()` fails | **PASSED** |
| **2b** | User with non-moderator role doc (`role: "admin"`) attempts status update | Auth user (`admin_user`, `role: "admin"`) | `ideas/idea_1` | `update { status: "Under Review", updatedAt }` | **PERMISSION DENIED** | `data.role == 'moderator'` fails | **PASSED** |
| **3** | User with valid moderator document updates idea to `Under Review` | Auth moderator (`mod_123`, `role: "moderator"`) | `ideas/idea_1` | `update { status: "Under Review", updatedAt: serverTimestamp() }` | **ALLOWED** | `isModerator() && isValidStatusUpdate()` | **PASSED** |
| **4** | Moderator updates idea to each canonical status (`Submitted`, `In Progress`, `Accepted`, `Implemented`) | Auth moderator | `ideas/idea_1` | `update { status: target, updatedAt: serverTimestamp() }` | **ALLOWED** | `incoming.status in allowedStatuses` | **PASSED** |
| **5** | Moderator attempts to set invalid / non-canonical status (`Rejected`, `Archived`, `Pending`) | Auth moderator | `ideas/idea_1` | `update { status: "Rejected", updatedAt: serverTimestamp() }` | **PERMISSION DENIED** | `incoming.status in allowedStatuses` fails | **PASSED** |
| **6** | Moderator attempts to mutate title alongside status | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", title: "Tampered" }` | **PERMISSION DENIED** | `diff.affectedKeys().hasOnly(['status', 'updatedAt'])` fails | **PASSED** |
| **7** | Moderator attempts to directly manipulate `upvoteCount` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", upvoteCount: 999 }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **8** | Moderator attempts to reassign `authorId` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", authorId: "other_uid" }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **9a** | Moderator attempts to modify `description` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", description: "Tampered" }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **9b** | Moderator attempts to modify `category` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", category: "Dining" }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **9c** | Moderator attempts to modify `authorName` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", authorName: "Forged" }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **9d** | Moderator attempts to modify `createdAt` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", createdAt: timestamp }` | **PERMISSION DENIED** | Affected keys check fails | **PASSED** |
| **10a** | Student attempts privilege escalation (self-granting moderator doc) | Auth user (`student_123`) | `moderators/student_123` | `create { role: "moderator" }` | **PERMISSION DENIED** | `allow write: if false` on `/moderators/{userId}` | **PASSED** |
| **10b** | Student attempts to modify existing moderator document | Auth user (`student_123`) | `moderators/existing_mod` | `update { role: "student" }` | **PERMISSION DENIED** | `allow write: if false` on `/moderators/{userId}` | **PASSED** |
| **10c** | Student attempts to delete moderator document | Auth user (`student_123`) | `moderators/existing_mod` | `delete` | **PERMISSION DENIED** | `allow write: if false` on `/moderators/{userId}` | **PASSED** |
| **10d** | Moderator attempts to create new moderator from client | Auth moderator (`existing_mod`) | `moderators/new_mod` | `create { role: "moderator" }` | **PERMISSION DENIED** | `allow write: if false` on `/moderators/{userId}` | **PASSED** |
| **10e** | Guest attempts to write moderator document | Unauthenticated visitor | `moderators/guest_escalate` | `create { role: "moderator" }` | **PERMISSION DENIED** | `allow write: if false` on `/moderators/{userId}` | **PASSED** |
| **11a** | Authenticated user reads moderator document to check role | Authenticated user | `moderators/mod_123` | `get` | **ALLOWED** | `allow read: if isAuthenticated()` | **PASSED** |
| **11b** | Guest reads moderator document | Unauthenticated visitor | `moderators/mod_123` | `get` | **PERMISSION DENIED** | `isAuthenticated()` fails | **PASSED** |
| **12** | Clients attempt idea deletion (guest, author, student, moderator) | Any client actor | `ideas/idea_1` | `delete` | **PERMISSION DENIED** | `allow delete: if false` on `/ideas/{ideaId}` | **PASSED** |
| **13** | Student creates vote for another user's UID (spoofing vote) | Auth user (`attacker_uid`) | `ideas/idea_1/votes/victim_uid` | `create { userId: "victim_uid", createdAt }` | **PERMISSION DENIED** | `request.auth.uid == ownerId && data.userId == ownerId` | **PASSED** |
| **14** | Authenticated user creates their own valid vote document | Auth user (`student_123`) | `ideas/idea_1/votes/student_123` | `create { userId: "student_123", createdAt: serverTimestamp() }` | **ALLOWED** | `isValidVote(userId)` | **PASSED** |
| **15** | User attempts to modify existing vote document | Auth user (`student_123`) | `ideas/idea_1/votes/student_123` | `update { createdAt: serverTimestamp() }` | **PERMISSION DENIED** | `allow update: if false` on `/votes/{userId}` | **PASSED** |
| **16a** | User attempts to delete another user's vote document | Auth user (`student_123`) | `ideas/idea_1/votes/other_user` | `delete` | **PERMISSION DENIED** | `request.auth.uid == userId` fails | **PASSED** |
| **16b** | User deletes their own vote document (toggle unvote) | Auth user (`student_123`) | `ideas/idea_1/votes/student_123` | `delete` | **ALLOWED** | `request.auth.uid == userId` | **PASSED** |
| **17a** | Proposal creation with full valid 9-field schema | Auth user | `ideas/{ideaId}` | `add { ...validIdea }` | **ALLOWED** | `isValidIdea()` | **PASSED** |
| **17b** | Proposal creation with `authorId: null` (anonymous proposal) | Guest / Auth user | `ideas/{ideaId}` | `add { ...validIdea, authorId: null }` | **ALLOWED** | `data.authorId == null` | **PASSED** |
| **17c-j** | Proposal creation schema violations (missing fields, extra fields, title length, desc length, category, status, upvotes, authorName length) | Any client | `ideas/{ideaId}` | `add { ...invalidPayload }` | **PERMISSION DENIED** | `isValidIdea()` constraints | **PASSED** |
| **18a** | Public & authenticated read on ideas collection and documents | Guest & Authenticated user | `ideas` & `ideas/{ideaId}` | `get` / collection query | **ALLOWED** | `allow read: if true;` on `/ideas/{ideaId}` | **PASSED** |
| **18b** | Public & authenticated read on votes subcollection | Guest & Authenticated user | `ideas/{ideaId}/votes` | `get` / collection query | **ALLOWED** | `allow read: if true;` on `/votes/{userId}` | **PASSED** |
| **19a** | Legitimate moderator status update with `serverTimestamp()` | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", updatedAt: serverTimestamp() }` | **ALLOWED** | `incoming.updatedAt == request.time` | **PASSED** |
| **19b** | Moderator attempts arbitrary future timestamp injection (`2099-01-01`) | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", updatedAt: Date(2099) }` | **PERMISSION DENIED** | `incoming.updatedAt == request.time` fails | **PASSED** |
| **19c** | Moderator attempts arbitrary past timestamp injection (`2000-01-01`) | Auth moderator | `ideas/idea_1` | `update { status: "Under Review", updatedAt: Date(2000) }` | **PERMISSION DENIED** | `incoming.updatedAt == request.time` fails | **PASSED** |

---

## 2. Review of Timestamp Security

### Limitation of Original Rule
The original rule checked:
```javascript
incoming.updatedAt is timestamp;
```
This check validated the **data type** (`timestamp`), but **not the value**. A client could pass arbitrary past timestamps (`new Date('1970-01-01')`) or arbitrary future timestamps (`new Date('2099-01-01')`), allowing clients to manipulate audit sorting or timestamp-based business logic.

### Smallest Safe Improvement
We evaluated tightening the validation to:
```javascript
incoming.updatedAt == request.time;
```
When client code executes `updateDoc(docRef, { status: newStatus, updatedAt: serverTimestamp() })`, Firestore resolves `serverTimestamp()` to `request.time` during rule evaluation.

### Verification
- **Legitimate update**: `updateIdeaStatus(ideaId, newStatus)` uses `serverTimestamp()`, which resolves to `request.time` and passes with `assertSucceeds`.
- **Arbitrary timestamp injection**: Supplying manual dates (`new Date('2099-01-01')` or `new Date('2000-01-01')`) fails with `PERMISSION_DENIED`.
- Verified in automated tests `19a`, `19b`, and `19c`.

---

## 3. Review of Privacy & Public Vote Reads

### Current Rule
```javascript
match /votes/{userId} {
  allow read: if true;
  ...
}
```

### Why Public Reads Are Used by the Current Application
1. **Client-side Vote Count Aggregation**: `getIdeaVoteCount(ideaId)` issues `getCountFromServer(collection(db, 'ideas', ideaId, 'votes'))`. In Firestore Security Rules, collection aggregation queries require `read` permission on the matched document set. If reading votes were restricted to authenticated users only (`if isAuthenticated()`), unauthenticated guests viewing the public homepage or idea details would fail to load vote counts.
2. **Vote Status Verification**: Checking whether the active user has voted on an idea reads `ideas/{ideaId}/votes/{userId}`.

### Privacy Implications
- Each document in `votes/{userId}` stores `userId: "<UID>"` and uses the voter's UID as the document ID.
- Because `allow read: if true;` is open to unauthenticated clients, any client can enumerate or query the `votes` subcollection to discover all student UIDs who voted for any specific proposal.
- **Recommended Production Architecture**: In a subsequent release, proposal vote counts should be maintained directly on the parent document (`ideas/{ideaId}.upvoteCount`) via Cloud Functions triggers (`onCreate` / `onDelete` on votes). This would allow restricting `ideas/{ideaId}/votes/{userId}` reads strictly to the vote owner (`allow read: if request.auth != null && request.auth.uid == userId;`), completely concealing voting history and voter identities while preserving public counters for guests.

---

## 4. How to Run the Automated Tests

Run the test suite using the local Firebase Emulator Suite:

```bash
npm run test:rules
```

The runner automatically locates the system Java Runtime (including JDK/JRE bundled with development tools on Windows), boots the Firestore Emulator, runs the 32 automated tests, and cleanly shuts down the emulator upon completion.
