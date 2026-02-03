# Service Request Flow Documentation

This document describes the updated Service Request flow, covering Lead Purchase, Job Execution (Offline), Completion, and Final Approval.

## 1. Request Creation & Matching
- Customer creates a request.
- Status: `PENDING`.
- Matching providers are notified.

## 2. Lead Purchase
Providers view the request and purchase the lead to unlock customer details.

- **Endpoint**: Sticker Checkout / Purchase API.
- **Action**:
    - Provider pays fee.
    - System adds provider to `purchasedBy` list.
    - **Status Change**: If status is `PENDING`, it updates to `PURCHASED`.
    - *Note*: Multiple providers can purchase the same lead.

## 3. Job Execution & Offline Negotiation
- **Status**: Remains `PURCHASED` (or `IN_PROGRESS` if manually updated).
- **Process**:
    - Providers contact customer (phone/email).
    - Negotiation happens offline.
    - Providers perform the work.
    - The system does **not** track who is "assigned" at this stage. It is a "race" or "competition".

## 4. Job Completion (The "Race")
The first provider to finish the job and submit proof "wins" the slot to be reviewed.

- **Endpoint**: `POST /api/v1/service-request/complete`
- **Payload**:
    - `requestId`: ID of the request.
    - `notes`: (Optional) Notes from provider.
    - `completionProof`: (File) Image/Video evidence.
- **Logic**:
    - **Pre-requisite**: Provider must have **Purchased** the lead.
    - **Race Condition Check**: System checks if status is `PURCHASED` or `IN_PROGRESS`.
    - **Success**:
        - Status updates to `COMPLETED`.
        - `completedBy` field is set to this Provider ID.
        - Notifications sent to Customer.
    - **Failure (Conflict)**:
        - If another provider has already marked it `COMPLETED`, subsequent requests will fail (Status is already `COMPLETED`).

## 5. Customer Approval & Assignment
Customer reviews the proof and approves the work.

- **Endpoint**: `PATCH /api/v1/service-request/status`
- **Payload**:
    - `requestId`: ID of request.
    - `status`: `APPROVED`.
- **Logic**:
    - Checks if `completedBy` is set (i.e., a provider has finished it).
    - **Assignment**: Sets `assignedProvider` = `completedBy`.
    - **Status**: Updates to `APPROVED`.
    - Notification sent to the winning Provider.

## Filtering Options (Admin/Dashboard)
- `status=PENDING`: Open requests, no purchases yet (or at least no completions).
- `status=PURCHASED`: Leads bought, work likely ongoing.
- `status=COMPLETED`: Work finished by a provider, awaiting customer approval.
- `status=APPROVED`: Job successfully finished and verified.

## Database Field Updates
- `purchasedBy`: Array of providers who bought the lead.
- `completedBy`: `ObjectId` of the provider who submitted proof first.
- `assignedProvider`: `ObjectId` of the final approved provider (set only after Approval).
