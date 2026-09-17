const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Primero quitamos el onDelete: NoAction, onUpdate: NoAction de TODOS
schema = schema.replace(/, onDelete: NoAction, onUpdate: NoAction/g, '');

// Ahora solo lo añadimos donde hay 'fields:'
schema = schema.replace(/@relation\(([^)]+)\)/g, (match, p1) => {
  if (p1.includes('fields:')) {
    if (p1.includes('onDelete') || p1.includes('onUpdate')) {
      return match;
    }
    return `@relation(${p1}, onDelete: NoAction, onUpdate: NoAction)`;
  }
  return match;
});

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Relations fixed properly');
