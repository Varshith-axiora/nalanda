const resp = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@nalanda.local", password: "Password@123" })
});
const data = await resp.text();
console.log("Status:", resp.status);
console.log("Body:", data);
