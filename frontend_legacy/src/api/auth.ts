const API_URL = "http://localhost:5000";

export async function registerStep1(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register/step1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Step 1 failed");
  }

  return res.json() as Promise<{ message: string; userId: string }>;
}

export async function registerStep2(userId: string, file: File) {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("pdf", file);

  const res = await fetch(`${API_URL}/auth/register/step2`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Step 2 failed");
  }

  return res.json();
}

export async function registerStep3(userId: string, phantomWallet: string) {
  const res = await fetch(`${API_URL}/auth/register/step3`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, phantomWallet }),
  });

  if (!res.ok) {
    throw new Error("Step 3 failed");
  }

  return res.json();
}
