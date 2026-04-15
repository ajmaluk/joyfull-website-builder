import { createClient } from "@supabase/supabase-js";

// Test Supabase connection and setup
async function testSupabaseConnection() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('=== Supabase Connection Test ===\n');

    // Check environment variables
    console.log('1. Environment Variables:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✓ Set' : '✗ Missing');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('\n✗ Error: Missing required environment variables');
        process.exit(1);
    }

    // Create client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    console.log('\n2. Testing Connection...');
    try {
        const { error } = await supabase.from('Project').select('id').limit(1);
        if (error) {
            console.error('   ✗ Connection failed:', error.message);
            process.exit(1);
        }
        console.log('   ✓ Connection successful');
    } catch (err) {
        console.error('   ✗ Connection failed:', err);
        process.exit(1);
    }

    // Check tables
    console.log('\n3. Checking Tables...');
    const tables = ['Project', 'Message', 'Fragment', 'Usage'];
    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.error(`   ✗ Table '${table}' error:`, error.message);
            } else {
                console.log(`   ✓ Table '${table}' exists`);
            }
        } catch (err) {
            console.error(`   ✗ Table '${table}' error:`, err);
        }
    }

    // Test consume_credits function
    console.log('\n4. Testing consume_credits RPC function...');
    try {
        const testUserId = 'test_verification_' + Date.now();
        const { data, error } = await supabase.rpc('consume_credits', {
            user_id: testUserId,
            cost: 1,
            max_points: 10,
            expire_days: 30,
        });

        if (error) {
            console.error('   ✗ RPC function error:', error.message);
            if (error.message.includes('function') && error.message.includes('does not exist')) {
                console.error('   ✗ The consume_credits function does not exist in your database.');
                console.error('   ✗ Please run the supabase-init.sql script in Supabase SQL Editor.');
            }
        } else {
            console.log('   ✓ RPC function works correctly');
            console.log('   Response:', data);

            // Clean up test data
            await supabase.from('Usage').delete().eq('key', testUserId);
            console.log('   ✓ Test data cleaned up');
        }
    } catch (err) {
        console.error('   ✗ RPC function error:', err);
    }

    // Check indexes
    console.log('\n5. Checking Indexes...');
    const indexes = ['Message_projectId_idx', 'Project_userId_idx'];
    for (const index of indexes) {
        try {
            const { data, error } = await supabase.rpc('check_index', { index_name: index });
            if (error) {
                console.log(`   ℹ Index '${index}' check skipped (function not available)`);
            } else {
                console.log(`   ✓ Index '${index}' exists`);
            }
        } catch (err) {
            console.log(`   ℹ Index '${index}' check skipped`);
        }
    }

    console.log('\n=== Test Complete ===');
}

testSupabaseConnection().catch(console.error);
