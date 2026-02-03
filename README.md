# 🔧 MaziMario Service Request System - User Guide

Welcome to the MaziMario Service Request System! This guide will help you understand how the system works, which APIs to use, and how to get the results you need.

## 📚 Table of Contents

- [What is This System?](#what-is-this-system)
- [How It Works - Complete Flow](#how-it-works---complete-flow)
- [For Customers](#for-customers)
- [For Service Providers](#for-service-providers)
- [For Admins](#for-admins)
- [API Reference Quick Guide](#api-reference-quick-guide)
- [Common Questions](#common-questions)

---

## What is This System?

MaziMario connects **customers** who need services (like plumbing, electrical work, cleaning, etc.) with qualified **service providers** in their area. Think of it like Uber, but for home services!

### Key Features

✅ **Smart Matching**: Automatically finds providers near you who offer the service you need  
✅ **Multiple Options**: Several providers can see your request and compete for your business  
✅ **Lead Purchase**: Providers pay a small fee to access your full contact details  
✅ **Transparent Process**: Track your request from creation to completion  
✅ **Quality Control**: Providers submit proof of completed work

---

## How It Works - Complete Flow

Here's the journey of a service request from start to finish:

```
┌─────────────────┐
│  1. CUSTOMER    │  Creates service request (cleaning, plumbing, etc.)
│  Creates Request│  Provides location, time, and details
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. SYSTEM      │  Finds providers who:
│  Finds Matches  │  • Offer that service
└────────┬────────┘  • Are within 50km
         │           • Are verified and available
         ▼
┌─────────────────┐
│  3. PROVIDERS   │  Multiple providers get notification
│  Get Notified   │  They can see basic details (but not customer contact)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. PROVIDER    │  Provider pays small fee ($1-5) to access full details
│  Pays for Lead  │  Multiple providers can purchase same request
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. CUSTOMER    │  Customer reviews all interested providers
│  Chooses        │  Picks the one they like best (price, reviews, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  6. PROVIDER    │  Chosen provider does the work
│  Does Work      │  Uploads photos/videos as proof when done
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  7. CUSTOMER    │  Customer reviews the proof
│  Reviews & Pays │  Approves completion and leaves review
└─────────────────┘
```

---

## For Customers

### Step 1: Create a Service Request

**What you need**: Login as a customer

**Endpoint**: `POST /service-requests/create`

**When to use**: When you need a service (plumbing, electrical, cleaning, etc.)

**What to provide**:
- **Service type**: What service do you need? (from available categories)
- **Location**: Where do you need the service? (address + map coordinates)
- **When**: Start and end date/time
- **Details**: Describe what you need done
- **Photos** (optional): Upload pictures to help providers understand

**Example Request**:
```json
{
  "serviceCategory": "63f8a9b1c...",  
  "subcategory": "63f8a9b1c...",      
  "address": "123 Main St, Dhaka",
  "latitude": "23.8103",
  "longitude": "90.4125",
  "startDate": "2026-02-01",
  "endDate": "2026-02-01",
  "startTime": "09:00",
  "endTime": "17:00",
  "customerPhone": "+8801712345678",
  "description": "Kitchen sink is leaking, needs repair",
  "priority": "Normal"
}
```

**What happens next**:
1. ✅ System creates your request with a unique ID (e.g., "TZ0123")
2. 🔍 System finds 3-5 providers in your area who offer this service
3. 🔔 Each provider gets a notification
4. 👀 Providers can see basic details but NOT your contact info (yet)

**Response** you'll get:
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Service request created successfully",
  "data": {
    "requestId": "TZ0123",
    "status": "PENDING",
    "serviceCategory": {
      "name": "Plumbing",
      "icon": "https://..."
    },
    "potentialProviders": [
      { "providerId": "...", "status": "PENDING" },
      { "providerId": "...", "status": "PENDING" },
      { "providerId": "...", "status": "PENDING" }
    ]
  }
}
```

---

### Step 2: Check Your Requests

**Endpoint**: `GET /service-requests/my-requests`

**When to use**: To see all your service requests and their status

**Filters you can use**:

| Filter | What it shows | Example |
|--------|---------------|---------|
| `?status=PENDING` | Requests waiting for providers | New requests |
| `?status=ONGOING` | Active jobs in progress | Service being done |
| `?status=COMPLETED` | Finished jobs | Work completed |
| `?status=DECLINED` | All providers said no | Need to modify request |

**Example**:
```
GET /service-requests/my-requests?status=ONGOING&page=1&limit=10
```

**What you'll see**:
- List of your requests
- Current status of each
- Which providers are interested
- Details about each job

---

### Step 3: View Detailed Information

**Endpoint**: `GET /service-requests/details?requestId=TZ0123`

**When to use**: To see everything about a specific request

**What you'll see**:
- Full service request details
- Which providers purchased your lead (interested providers)
- Status updates
- Completion proof (when done)
- All photos and notes

---

## For Service Providers

### Step 1: See Available Requests

**Endpoint**: `GET /provider/potential-requests`

**When to use**: To find new service requests in your area

**Important filters**:

| Filter | What it shows | When to use |
|--------|---------------|-------------|
| `?providerStatus=PENDING` | **New requests** you haven't responded to | Check for new work (DEFAULT) |
| `?providerStatus=PAID` | Requests **you purchased** | See leads you paid for |
| `?providerStatus=ACCEPTED` | Requests you accepted (free) | Your accepted jobs |
| `?providerStatus=DECLINED` | Requests you said no to | See rejected jobs |

**Example**:
```
GET /provider/potential-requests?providerStatus=PENDING&page=1
```

**What you'll see** (for unpurchased leads):
```json
{
  "requests": [{
    "requestId": "TZ0123",
    "serviceCategory": { "name": "Plumbing" },
    "description": "Kitchen sink is leaking",
    "address": "General area only (locked)",
    "priority": "Urgent",
    "leadPrice": 500,  // $5.00
    "status": "PENDING"
  }]
}
```

> **Note**: Customer's name, phone, and exact address are **hidden** until you purchase the lead!

---

### Step 2: Purchase a Lead

**What you need to know**:
- 💰 Each lead costs $1-$5 (depends on service type)
- 👥 **Multiple providers can buy the same lead** (up to 5 providers)
- 🏆 Customer picks which provider they want
- 🔓 Once you pay, you get full customer contact details

**Endpoint**: `POST /leads/create-checkout`

**Request**:
```json
{
  "requestId": "TZ0123"
}
```

**Response**:
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_...",
  "leadPurchaseId": "63f..."
}
```

**What to do**:
1. Click the `url` to go to Stripe payment page
2. Complete payment
3. System automatically unlocks customer details
4. You can now see full information

---

### Step 3: View Full Request Details (After Purchase)

**Endpoint**: `GET /service-requests/details?requestId=TZ0123`

**After you purchase**, you'll see:
```json
{
  "requestId": "TZ0123",
  "customerId": {
    "name": "John Doe",              // ✅ Now visible
    "email": "john@example.com",     // ✅ Now visible
    "phoneNumber": "+8801712345678", // ✅ Now visible
    "address": "123 Main St, Dhaka"  // ✅ Now visible
  },
  "serviceCategory": { "name": "Plumbing" },
  "description": "Kitchen sink is leaking, needs repair",
  "startDate": "2026-02-01",
  "startTime": "09:00"
}
```

**Now you can**:
- 📞 Call the customer
- 📧 Email them
- 💬 Chat with them
- 📍 See exact location

---

### Step 4: Complete the Service

**Endpoint**: `POST /service-requests/complete`

**When to use**: After you finish the job

**What to provide**:
- Request ID
- Completion notes
- **Proof photos/videos** (required!)

**Example**:
```json
{
  "requestId": "TZ0123",
  "notes": "Replaced faulty fittings, tested for leaks. All working now.",
  "completionProof": [<Photo1>, <Photo2>, <Video>]
}
```

**What happens**:
1. ✅ Your photos/videos are uploaded
2. 🔔 Customer gets notified
3. 👀 Customer reviews your work
4. ⭐ Customer can approve and leave a review

---

## For Admins

### View All Requests

**Endpoint**: `GET /service-requests/get-all`

**Filters**:
- `?status=PENDING` - New requests
- `?status=PROCESSING` - Jobs in progress
- `?status=COMPLETED` - Finished jobs
- `?page=1&limit=20` - Pagination

**What you see**:
- All service requests in the system
- Customer and provider details
- Status of each request
- Any issues or disputes

---

### Manually Assign a Provider

**Endpoint**: `PATCH /service-requests/assign-provider`

**When to use**: When you need to manually assign a provider (e.g., all providers declined, or special case)

**Request**:
```json
{
  "requestId": "TZ0123",
  "providerId": "63f8a9b1c..."
}
```

---

## API Reference Quick Guide

### Customer Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/service-requests/create` | Create new service request | User |
| GET | `/service-requests/my-requests` | Get all my requests | User |
| GET | `/service-requests/details?requestId=X` | View request details | User |

### Provider Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/provider/potential-requests` | See available requests | Provider |
| POST | `/leads/create-checkout` | Purchase a lead | Provider |
| GET | `/service-requests/details?requestId=X` | View request (after purchase) | Provider |
| POST | `/service-requests/complete` | Submit completed work | Provider |

### Admin Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/service-requests/get-all` | View all requests | Admin |
| PATCH | `/service-requests/assign-provider` | Manually assign provider | Admin |

---

## Common Questions

### ❓ How many providers can see my request?

Usually 3-5 providers in your area who offer the service you need. The system automatically matches based on:
- Service category
- Location (within 50km and provider's covered radius)
- Provider availability
- Verification status

---

### ❓ Do providers see my contact info immediately?

**No!** Providers initially see:
- ✅ Service type and description
- ✅ General area
- ✅ Date/time needed
- ✅ Priority level
- ❌ Your name (shows as "Customer Locked")
- ❌ Your phone number
- ❌ Your exact address

They must **purchase the lead** to unlock your full contact information.

---

### ❓ Can multiple providers purchase my request?

**Yes!** Up to 5 providers can purchase the same request. This gives you options:
- Compare multiple providers
- Check their reviews and ratings
- Choose based on price or experience
- Pick who you feel most comfortable with

---

### ❓ What happens if no providers are interested?

If all providers decline:
1. Request status remains `PENDING`
2. You can modify your request (add details, change time, etc.)
3. Admin can manually assign a provider
4. System may notify additional providers if new ones register

---

### ❓ How do I filter requests to find what I need?

**For Customers**:
```
GET /service-requests/my-requests?status=PENDING     ← New requests
GET /service-requests/my-requests?status=ONGOING     ← Active jobs
GET /service-requests/my-requests?status=COMPLETED   ← Finished jobs
```

**For Providers**:
```
GET /provider/potential-requests?providerStatus=PENDING   ← New opportunities
GET /provider/potential-requests?providerStatus=PAID      ← Leads I bought
```

---

### ❓ What's the difference between "assigned" and "purchased"?

- **Purchased**: Provider paid to access your details, but you haven't chosen them yet
- **Assigned**: Provider is officially working on your request (only ONE provider can be assigned)

Multiple providers can purchase, but only one gets assigned!

---

### ❓ How much does a lead cost for providers?

Lead prices vary by service type:
- Basic services (cleaning, etc.): $1-2
- Specialized services (electrician, plumber): $3-5
- Urgent/emergency requests: May have higher price

Price is shown before provider purchases: `"leadPrice": 500` means $5.00 (price is in cents)

---

### ❓ What if I'm a provider and the customer doesn't choose me?

Unfortunately, that's part of the business:
- You paid to access the customer's information
- Customer can choose any provider who purchased
- Not all leads convert to jobs
- This is similar to advertising costs in traditional business
- **Tip**: Respond quickly and professionally to increase your chances!

---

### ❓ Can I cancel a request after creating it?

Yes! Contact admin or update the request status. If providers have already purchased your information, you should still communicate with them professionally.

---

### ❓ How do I know the work is completed properly?

Providers must submit **proof of completion**:
- Photos of the completed work
- Videos showing the service
- Notes explaining what was done

You can review this proof before approving the job.

---

## Status Guide

Understanding request statuses:

| Status | What it Means | For Customer | For Provider |
|--------|---------------|--------------|--------------|
| `PENDING` | Just created, waiting for responses | Wait for providers | New opportunity! |
| `PURCHASED` | Provider(s) bought your info | Review interested providers | You can see customer details |
| `ASSIGNED` | One provider selected | Service about to start | You got the job! |
| `PROCESSING` | Work in progress | Service happening now | Complete the work |
| `COMPLETED` | Provider submitted proof | Review and approve | Awaiting customer review |
| `APPROVED` | Customer approved | Job done! | Get paid! |
| `DECLINED` | All providers said no | Modify or repost | Not interested |
| `CANCELLED` | Customer cancelled | Cancelled | Lead closed |

---

## Tips for Success

### For Customers 👨‍💼

1. **Be detailed**: More information helps providers give accurate quotes
2. **Add photos**: Pictures help providers understand the issue
3. **Be flexible**: Flexible timing attracts more providers
4. **Respond quickly**: When providers contact you, respond fast
5. **Leave reviews**: Help others by reviewing providers

### For Providers 🔧

1. **Keep profile updated**: Accurate service areas and availability
2. **Respond fast**: Quick responses win more jobs
3. **Be professional**: First impression matters
4. **Show your work**: Upload quality completion photos
5. **Build reputation**: Good reviews lead to more direct requests

---

## Need Help?

- **Technical Issues**: Contact technical support
- **Account Problems**: Email support@mazimario.com
- **Disputes**: Use the admin dispute resolution system
- **Feature Requests**: Submit via the feedback form

---

## API Authentication

All API requests require authentication:

```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

Get your token by logging in through `/auth/login`

---

**Last Updated**: January 23, 2026  
**Version**: 2.0  
**System**: MaziMario Service Request Platform
