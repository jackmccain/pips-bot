// Print the phone numbers on your Linq account. Quick auth/connectivity check.
import { listNumbers } from '../src/linq.js';

const data = await listNumbers();
const numbers = data.phone_numbers || [];
if (numbers.length === 0) {
  console.log('No phone numbers found on this account.');
} else {
  console.log('Phone numbers on this account:');
  for (const n of numbers) {
    console.log(`  ${n.phone_number}  [${n.health_status?.status ?? '?'}]  id=${n.id}`);
  }
}
