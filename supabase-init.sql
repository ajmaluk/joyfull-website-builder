-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Create the Project table
CREATE TABLE IF NOT EXISTS "Project" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the Message table
CREATE TABLE IF NOT EXISTS "Message" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('USER', 'ASSISTANT')),
    "type" TEXT NOT NULL CHECK ("type" IN ('RESULT', 'ERROR')),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "projectId" UUID NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE
);

-- Create the Fragment table
CREATE TABLE IF NOT EXISTS "Fragment" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "messageId" UUID NOT NULL UNIQUE REFERENCES "Message"("id") ON DELETE CASCADE,
    "sandboxUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the Usage table
CREATE TABLE IF NOT EXISTS "Usage" (
    "key" TEXT PRIMARY KEY,
    "points" INTEGER NOT NULL,
    "expire" TIMESTAMP WITH TIME ZONE
);

-- Create the Activity table
CREATE TABLE IF NOT EXISTS "Activity" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- e.g., 'PROJECT_CREATED', 'MESSAGE_SENT'
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the ApiKey table
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. Create Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS "Message_projectId_idx" ON "Message" ("projectId");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project" ("userId");
CREATE INDEX IF NOT EXISTS "Activity_userId_idx" ON "Activity" ("userId");
CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON "Activity" ("createdAt");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey" ("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_key_idx" ON "ApiKey" ("key");

-- ==========================================
-- 3. Utility Functions & Triggers
-- ==========================================

-- Function to handle updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updatedAt
DROP TRIGGER IF EXISTS update_project_updated_at ON "Project";
CREATE TRIGGER update_project_updated_at BEFORE UPDATE ON "Project" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_updated_at ON "Message";
CREATE TRIGGER update_message_updated_at BEFORE UPDATE ON "Message" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_fragment_updated_at ON "Fragment";
CREATE TRIGGER update_fragment_updated_at BEFORE UPDATE ON "Fragment" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_key_updated_at ON "ApiKey";
CREATE TRIGGER update_api_key_updated_at BEFORE UPDATE ON "ApiKey" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 4. Atomic Credit consumption (RPC)
-- ==========================================

CREATE OR REPLACE FUNCTION consume_credits(user_id TEXT, cost INT, max_points INT, expire_days INT)
RETURNS JSONB AS $$
DECLARE
    current_usage RECORD;
    new_expire TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT * FROM "Usage" WHERE "key" = user_id INTO current_usage;
    
    -- If no usage or expired, reset
    IF current_usage IS NULL OR current_usage.expire < NOW() THEN
        new_expire := NOW() + (expire_days || ' days')::INTERVAL;
        INSERT INTO "Usage" ("key", "points", "expire")
        VALUES (user_id, cost, new_expire)
        ON CONFLICT ("key") DO UPDATE
        SET "points" = cost, "expire" = EXCLUDED.expire
        RETURNING * INTO current_usage;
        RETURN row_to_json(current_usage)::JSONB;
    END IF;

    -- Check points
    IF current_usage.points + cost > max_points THEN
        RAISE EXCEPTION 'OUT_OF_CREDITS';
    END IF;

    -- Update points
    UPDATE "Usage"
    SET "points" = "points" + cost
    WHERE "key" = user_id
    RETURNING * INTO current_usage;

    RETURN row_to_json(current_usage)::JSONB;
END;
$$ LANGUAGE plpgsql;

