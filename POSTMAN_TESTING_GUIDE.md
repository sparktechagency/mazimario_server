# Postman Testing Guide - Service Request System

**Updated: February 2, 2026**

This guide details the complete lifecycle of a Service Request in the MaziMario system.

> [!IMPORTANT]
> **Status Updates**:
> - **After Purchase**: Request moves to **On Going** (Status: `IN_PROGRESS`).
> - **Provider Status**: Becomes `ACCEPTED`.
> - **View List**: Use `providerStatus=ACCEPTED` to see purchased/ongoing leads.

---

## 1. Prerequisites & Setup

**Base URL**: `http://localhost:5000`

**Authentication Tokens Needed**:
- `CUSTOMER_TOKEN`: A registered customer account.
- `PROVIDER_A_TOKEN`: A registered provider (Provider A).
- `PROVIDER_B_TOKEN`: A different registered provider (Provider B).
- `ADMIN_TOKEN`: Admin account.

**Environment Variables Setup**:
Create a Postman Environment with:
- `BASE_URL`
- `CUSTOMER_TOKEN`
- `PROVIDER_A_TOKEN`
- `PROVIDER_B_TOKEN`
- `ADMIN_TOKEN`
- `requestId` (Will be set dynamically during testing)

---

## 2. Customer Flow: Create Request

### 2.1 Create Service Request
**Endpoint**: `POST {{BASE_URL}}/service-requests/create`
**Auth**: Bearer `{{CUSTOMER_TOKEN}}`
**Body** (`multipart/form-data`):
- `serviceCategory`: `[Category_ID]`
- `subcategory`: `[Subcategory_ID]`
- `customerPhone`: `+8801700000000`
- `date`: `2026-03-20`
- `time`: `10:00`
- `address`: `123 Test Lane`
- `latitude`: `23.7`
- `longitude`: `90.3`
- `description`: `Need sink repair.`
- `attachments`: `[File]`

**Test Check**:
- Status Code: `201 Created`
- Response: Save `data.requestId` to environment variable `requestId`.
- Status: `PENDING`

---

## 3. Provider Flow: View & Purchase Lead

### 3.1 View Pending Requests
**Endpoint**: `GET {{BASE_URL}}/provider/potential-requests?providerStatus=PENDING`
**Auth**: `{{PROVIDER_A_TOKEN}}`
**Check**: Shows request with masked details.

### 3.2 Accept & Purchase Lead
**Endpoint**: `PATCH {{BASE_URL}}/provider/handle-request`
**Auth**: Bearer `{{PROVIDER_A_TOKEN}}`
**Body** (`JSON`):
```json
{
  "requestId": "{{requestId}}",
  "action": "ACCEPT"
}
```

**Response (If Paid Lead)**:
- `requiresPayment`: `true`
- `paymentUrl`: `https://checkout.stripe.com/c/pay/...` (Click this to pay)
- `leadFee`: `500`

**Action**: Open `paymentUrl` in browser to simulate payment.

---

## 4. Provider Flow: Access On Going (Purchased) Leads

### 4.1 **View On Going Requests**
Once you have paid (or if the lead was free), the request moves from "PENDING" to "ON GOING".

**Endpoint**: `GET {{BASE_URL}}/provider/potential-requests?providerStatus=ACCEPTED`
**Auth**: `{{PROVIDER_A_TOKEN}}`
**Check**: 
-   Returns list of requests you have purchased/accepted.
-   **Status in Response**: `IN_PROGRESS` (User visible: On Going).

### 4.2 **View Request Details**
To see full details (Phone, Address) of a specific request you own:

**Endpoint**: `GET {{BASE_URL}}/provider/potential-request?requestId={{requestId}}`
**Auth**: `{{PROVIDER_A_TOKEN}}`
**Check**: Returns object with **UNMASKED** customer details.

---

## 5. Execution Flow: The "Race"

*Note: Work happens offline. There is no API step for "Start Job".*

### 5.1 Provider A Completes First
**Endpoint**: `PATCH {{BASE_URL}}/provider/mark-complete`
**Auth**: Bearer `{{PROVIDER_A_TOKEN}}`
**Body** (`multipart/form-data`):
- `requestId`: `{{requestId}}`
- `completionProof`: `[Main_Proof_Image]`
- `notes`: `Fix done.`

**Test Check**:
- Status Code: `200 OK`
- Status in DB: `COMPLETED`
- `completedBy`: Provider A ID

---

## 6. Customer Flow: Approval

### 6.1 Review Completion
**Endpoint**: `GET {{BASE_URL}}/service-requests/details?requestId={{requestId}}`
**Auth**: `{{CUSTOMER_TOKEN}}`
**Check**: Customer sees the Proof uploaded by Provider A.

### 6.2 Approve Work
**Endpoint**: `PATCH {{BASE_URL}}/service-requests/update-status`
**Auth**: `{{CUSTOMER_TOKEN}}`
**Body** (`JSON`):
```json
{
  "requestId": "{{requestId}}",
  "status": "APPROVED"
}
```

**Test Check**:
- Status Code: `200 OK`
- Status: `APPROVED`
- `assignedProvider`: Now set to Provider A.

---

## 7. Helper: Webhook Simulation (Localhost Only)

**CRITICAL FOR LOCAL TESTING**: 
Since Stripe cannot hit your localhost directly, you must forward events using the Stripe CLI.

1.  **Open a Terminal** and run:
    ```bash
    stripe listen --forward-to localhost:5000/stripe/webhook
    ```
2.  **Copy the Webhook Secret** (starts with `whsec_...`) printed in the terminal.
3.  **Update your `.env` file**:
    ```env
    STRIPE_WEBHOOK_SECRET=whsec_...
    ```
4.  **Restart your server**.

Now, when you pay via the Checkout Link, Stripe CLI will receive the event and forward it to your local server.

### Alternative: Manual Simulation
If you cannot use the CLI, use this Postman request to "fake" the payment event:

**Endpoint**: `POST {{BASE_URL}}/stripe/webhook`
**Body**:
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "<SESSION_ID_FROM_STEP_3>",
      "metadata": {
        "providerId": "<PROVIDER_ID>",
        "serviceRequestId": "<SERVICE_REQUEST_ID_MONGO_ID>",
        "type": "LEAD_PURCHASE"
      },
// ## 8. Phone Verification (Twilio)

// Use these endpoints to verify a user's phone number.

// ### 8.1 Send Code
// **Endpoint**: `POST {{BASE_URL}}/phone-verification/send-code`
// **Body**:
{
  "phoneNumber": "+15550001234",
  "userType": "USER"
}
// ```

// ### 8.2 Verify Code
// **Endpoint**: `POST {{BASE_URL}}/phone-verification/verify-code`
// **Body**:
// 
{
  "phoneNumber": "+15550001234",
  "code": "12345"
}
```
*Note: In development, the code is printed in the server console.*
