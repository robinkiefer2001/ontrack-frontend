-- Datenbanken
CREATE DATABASE authentikdb;

-- User
CREATE USER svc_authentik WITH PASSWORD '__authPASSWORD__';

-- Rechte
GRANT ALL PRIVILEGES ON DATABASE authentikdb TO svc_authentik;

-- Connect and grant schema rights
\connect authentikdb
GRANT ALL ON SCHEMA public TO svc_authentik;
ALTER SCHEMA public OWNER TO svc_authentik;

-- Create ontrackdb
CREATE DATABASE ontrackdb;

-- User
CREATE USER svc_ontrack WITH PASSWORD '__ontrackPASSWORD__';

-- Rechte
GRANT ALL PRIVILEGES ON DATABASE ontrackdb TO svc_ontrack;

-- Connect and grant schema rights
\connect ontrackdb
GRANT ALL ON SCHEMA public TO svc_ontrack;
ALTER SCHEMA public OWNER TO svc_ontrack;

-- OnTrack Produktivschema

-- Mandanten (Kunden)
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Benutzer (nur Referenz auf Authentik-User)
CREATE TABLE users (
    id UUID PRIMARY KEY, -- entspricht Authentik-User-ID
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Kunden
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    zip INTEGER
);

-- Projekte
CREATE TABLE projects (
    project_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id INTEGER REFERENCES customers(customer_id),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    due_date DATE,
    budget NUMERIC,
    project_manager TEXT,
    status TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projektphasen
CREATE TABLE project_phases (
    phase_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    phase_name TEXT NOT NULL,
    start_date DATE,
    due_date DATE
);

-- Risiken
CREATE TABLE project_risks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    title TEXT NOT NULL,
    impact TEXT,
    probability TEXT,
    mitigation TEXT,
    is_open BOOLEAN DEFAULT TRUE
);

-- Aufgaben (Tasks)
CREATE TABLE tasks (
    task_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    phase_id INTEGER REFERENCES project_phases(phase_id),
    title TEXT NOT NULL,
    description TEXT,
    project_phase TEXT,
    status TEXT,
    assigned_to TEXT,
    start_date DATE,
    due_date DATE,
    notification_sent BOOLEAN DEFAULT FALSE,
    estimated_hours NUMERIC,
    hourly_rate_type TEXT,
    is_critical BOOLEAN,
    risk_note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subtasks
CREATE TABLE subtasks (
    subtask_id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(task_id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    assigned_to TEXT,
    start_date DATE,
    due_date DATE,
    estimated_hours NUMERIC,
    hourly_rate_type TEXT,
    is_critical BOOLEAN,
    risk_note TEXT
);

-- Mitarbeiter (Employees)
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    department TEXT,
    role TEXT,
    start_date DATE
);

-- Projekt-Mitarbeiter-Zuordnung (Team)
CREATE TABLE project_team (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    role TEXT,
    assigned_at TIMESTAMP DEFAULT NOW()
);

-- Stundensätze
CREATE TABLE hourly_rates (
    rate_id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    rate_type TEXT NOT NULL,
    hourly_rate NUMERIC NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

-- Projekt-Stundensätze
CREATE TABLE project_hourly_rates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id),
    rate_id INTEGER NOT NULL REFERENCES hourly_rates(rate_id)
);

-- Kunden-Mitarbeiter
CREATE TABLE customer_employees (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    job_title TEXT,
    department TEXT,
    employment_percent INTEGER,
    default_hours_per_week INTEGER
);

-- Indexe für Performance
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);

