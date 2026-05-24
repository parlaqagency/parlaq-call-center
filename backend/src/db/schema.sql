CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  extension VARCHAR(10) NOT NULL UNIQUE,
  phone VARCHAR(15),
  email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'offline',
  queue VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100),
  company VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  unique_id VARCHAR(50),
  agent_id INTEGER REFERENCES agents(id),
  customer_id INTEGER REFERENCES customers(id),
  customer_phone VARCHAR(15),
  direction VARCHAR(10),
  status VARCHAR(20),
  duration INTEGER,
  recording_url TEXT,
  notes TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autocall_campaigns (
  id SERIAL PRIMARY KEY,
  netgsm_list_id VARCHAR(20),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_numbers INTEGER DEFAULT 0,
  called_numbers INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS breaks (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id),
  reason VARCHAR(100),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);
