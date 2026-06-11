require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🚀 Pokretanje migracije baze...');
    
    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    await pool.query(schema);
    
    console.log('✅ Migracija uspješna! Sve tablice su kreirane.');
    
    // Provjeri tablice
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log('\n📋 Tablice u bazi:');
    result.rows.forEach(row => console.log(`   • ${row.tablename}`));
    
  } catch (err) {
    console.error('❌ Greška pri migraciji:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
