

async function testLogin() {
  try {
    const resp = await fetch("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@nalanda.local", password: "Password@123" })
    });
    const data = await resp.json();
    console.log("Status:", resp.status);
    console.log("Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testLogin();
