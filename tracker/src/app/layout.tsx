import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import NavBar from './NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: 'Track your LinkedIn job applications',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <html lang="en">
      <body>
        <NavBar session={session} />
        <main>{children}</main>
      </body>
    </html>
  )
}
