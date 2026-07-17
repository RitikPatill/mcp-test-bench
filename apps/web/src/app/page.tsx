import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge variant="secondary">v0.1.0-alpha</Badge>
        <h1 className="text-4xl font-bold tracking-tight">MCP Test Bench</h1>
        <p className="max-w-md text-muted-foreground">
          Evaluation harness for Model Context Protocol servers. Discover tools, generate test
          scenarios, score with LLM-as-judge, and audit for security issues.
        </p>
        <Button size="lg">MCP Test Bench — coming soon</Button>
      </div>
    </main>
  )
}
