export type DemoRole = "hospital" | "patient"

export type DemoUser = { username: string; role: DemoRole; displayName: string; patientId?: string }

const SESSION_KEY = "calle_demo_session"
const patientAccounts = [
  ["154515", "Sanal"],
  ["1023", "Pournnami"],
  ["TEST834", "Shone Bijju"],
  ["TEST991", "Malavika"],
  ["TEST187", "Shahmas"],
  ["TEST185", "Unknown"],
  ["TEST4492", "Jayadeep"],
  ["TEST449", "Jassim"],
  ["TEST5986", "Jayadeep"],
] as const

const accounts: Array<DemoUser & { password: string }> = [
  { username: "hospital", password: "hospital123", role: "hospital", displayName: "Hospital Care Team" },
  ...patientAccounts.map(([id, name]) => ({ username: id.toLowerCase(), password: id, role: "patient" as const, displayName: name, patientId: id })),
]

export function signInDemo(username: string, password: string): DemoUser | null {
  const account = accounts.find(item => item.username === username.trim().toLowerCase() && item.password === password)
  if (!account) return null
  const user: DemoUser = { username: account.username, role: account.role, displayName: account.displayName, patientId: account.patientId }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event("calle-demo-auth-change"))
  return user
}

export function getDemoUser(): DemoUser | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    if (!value) return null
    const user = JSON.parse(value) as DemoUser
    if (!user || (user.role !== "hospital" && user.role !== "patient")) return null
    if (user.role === "patient") {
      const account = accounts.find(item => item.role === "patient" && item.username === user.username)
      return account ? { username: account.username, role: "patient", displayName: account.displayName, patientId: account.patientId } : null
    }
    return { username: "hospital", role: "hospital", displayName: "Hospital Care Team" }
  } catch {
    return null
  }
}

export function signOutDemo(): void {
  localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event("calle-demo-auth-change"))
}
