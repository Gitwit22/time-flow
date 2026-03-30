import { Zap, Clock, FileText, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  { icon: Clock, title: "Clock In/Out", desc: "One-click time tracking with live session timers." },
  { icon: FileText, title: "Auto Invoicing", desc: "Generate polished invoices from tracked hours instantly." },
  { icon: Users, title: "Client Portal", desc: "Read-only access for clients to view hours & invoices." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-4 border-b bg-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-lg">TimeFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 sm:px-10 py-20 sm:py-32 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-heading font-bold tracking-tight leading-tight">
          Track work hours, generate invoices, and share progress with clients.
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
          A simple, professional platform for freelancers and contractors to manage time, billing, and client transparency — all in one place.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/signup">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="summary-card text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-accent/10 text-accent mb-4">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © 2026 TimeFlow. Built for contractors.
      </footer>
    </div>
  );
}
