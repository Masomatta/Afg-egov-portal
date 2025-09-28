Afghan E-Government Portal 
Features
For Citizens

Register and log in securely

Apply for government services online

Upload required documents (PDF, JPG, PNG)

Track the status of applications

Secure logout to prevent unauthorized access

For Officers

Manage service requests submitted by citizens

Access assigned applications and documents

Update status of requests

For Admin
Manage services and departments

Tech Stack

Backend: Node.js, Express.js

Database: PostgreSQL

Authentication: express-session, bcryptjs

File Upload: multer

Frontend: EJS templates

Installation

Clone the repository

git clone https://github.com/yourusername/afghan-egov-portal.git
Install dependencies

npm install


Setup environment variables
Create a .env file with the following:

PORT=3000
DATABASE_URL=postgresql://username:password@host:port/dbname
SESSION_SECRET=your_long_random_secret_string
NODE_ENV=development


Start the server

npm start


Open the application
Visit http://localhost:3000 in your browser.

Folder Structure
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
