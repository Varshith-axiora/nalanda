import bcrypt from "bcryptjs";
const hash = '$2a$10$X8T/mQyJ/L7Z2G4t/KjB9O0T/Xm1zHwzG1sT5k9hT/Jv1kH/0O0K';
const pass = 'Password@123';
console.log("Match:", bcrypt.compareSync(pass, hash));
