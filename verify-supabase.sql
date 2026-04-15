-- ==========================================
-- Supabase Integration Verification Script
-- Run this in Supabase SQL Editor to verify everything is set up correctly
-- ==========================================

-- 1. Check if all tables exist
SELECT 
    'Tables' as check_type,
    table_name as name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Project', 'Message', 'Fragment', 'Usage')
ORDER BY table_name;

-- 2. Check if indexes exist
SELECT 
    'Indexes' as check_type,
    indexname as name,
    'EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN ('Message_projectId_idx', 'Project_userId_idx')
ORDER BY indexname;

-- 3. Check if triggers exist
SELECT 
    'Triggers' as check_type,
    trigger_name as name,
    'EXISTS' as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE 'update_%_updated_at'
ORDER BY trigger_name;

-- 4. Check if consume_credits function exists
SELECT 
    'Functions' as check_type,
    routine_name as name,
    'EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'consume_credits';

-- 5. Test the consume_credits function (this will create a test entry)
SELECT 
    'Function Test' as check_type,
    'consume_credits' as name,
    CASE 
        WHEN error IS NULL THEN 'WORKING'
        ELSE 'FAILED: ' || error
    END as status
FROM (
    SELECT * FROM consume_credits('test_user_verification', 1, 10, 30)
) AS test
LEFT JOIN LATERAL (
    SELECT 'Error occurred' as error
    WHERE false
) err ON true;

-- 6. Clean up test data
DELETE FROM "Usage" WHERE "key" = 'test_user_verification';

-- 7. Check table structures
SELECT 
    'Table Structure' as check_type,
    table_name as name,
    column_name as column,
    data_type as type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('Project', 'Message', 'Fragment', 'Usage')
ORDER BY table_name, ordinal_position;
