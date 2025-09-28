-- Create database
CREATE DATABASE egovernment;

-- Create tables
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    national_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    contact_info TEXT,
    department_id INTEGER REFERENCES departments(id),
    job_title VARCHAR(255),
    user_type VARCHAR(20) CHECK (user_type IN ('citizen', 'officer', 'department_head', 'admin')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES departments(id) NOT NULL,
    fee DECIMAL(10, 2) DEFAULT 0,
    requirements TEXT
);

CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER REFERENCES users(id) NOT NULL,
    service_id INTEGER REFERENCES services(id) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')) DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    notes TEXT
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_id VARCHAR(255),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending'
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample departments
INSERT INTO departments (name, description) VALUES 
('Interior', 'Handles passport, national ID, and civil registration services'),
('Commerce', 'Handles business licenses and commercial registrations'),
('Housing', 'Handles land registration and property services');

-- Insert sample admin user (password: admin123)
INSERT INTO users (national_id, email, password, name, user_type) VALUES 
('admin001', 'admin@egov.com', '$2a$10$rOzZzB5sWcS.7kC2Ykq8UeLwQzQ1rB2nXkZzV3rY4vX1wV2nZ3mM', 'System Administrator', 'admin');

-- Insert sample services
INSERT INTO services (name, description, department_id, fee) VALUES
('Passport Renewal', 'Renewal of expired passport', 1, 75.00),
('National ID Update', 'Update information on national ID card', 1, 10.00),
('Business License', 'Application for new business license', 2, 200.00),
('Land Registration', 'Registration of land property', 3, 150.00);