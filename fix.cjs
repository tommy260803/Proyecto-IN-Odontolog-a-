const fs = require('fs');
let schema = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
schema = schema.replace('provider = "sqlserver"', 'provider = "sqlite"');
schema = schema.replace(/url\s+=\s+env\("SQLSERVER_URL"\)/, 'url = "file:./dev.db"');
schema = schema.replace(/@db\.\w+(\([^)]*\))?/g, '');
schema = schema.replace(/Decimal/g, 'Float');
schema = schema.replace(/ +$/gm, '');
fs.writeFileSync('backend/prisma/schema.prisma', schema);
console.log('Schema updated successfully!');
