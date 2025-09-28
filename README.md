# Afghan E-Government Portal
## Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL
* **Authentication:** express-session, bcryptjs
* **File Upload:** multer
* **Frontend:** EJS templates, HTML, CSS, JavaScript
* **Middleware:** Custom auth and role-based access control
* **Hosting:** Can be deployed on Render or other Node.js hosting services

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/afghan-egov-portal.git
```

2. **Install dependencies**

```bash
npm install
```
```
PORT=3000
```

4. **Start the server**

```bash
npm start
```

5. **Open the application**
   Visit `http://localhost:3000` in your browser.

## Folder Structure

```
.
├── config/
│   └── database.js          # PostgreSQL pool setup
├── middleware/
│   ├── auth.js              # Authentication and role-checking middleware
│   └── upload.js            # Multer file upload configuration
├── public/
│   └── uploads/             # Folder to save uploaded files
├── routes/
│   ├── auth.js              # Login/Register routes
│   ├── citizen.js           # Citizen dashboard and apply routes
│   ├── officer.js           # Officer routes
│   └── admin.js             # Admin routes
├── views/
│   ├── auth/
│   ├── citizen/
│   ├── officer/
│   ├── admin/
│   └── partials/
├── app.js                    # Main entry point
├── package.json
└── README.md
```
