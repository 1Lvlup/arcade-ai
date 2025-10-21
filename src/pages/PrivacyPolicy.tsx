import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Privacy Policy" showBackButton={true} backTo="/" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="space-y-6 text-foreground">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us when you create an account, 
                use our AI assistant, and interact with our services. This includes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Email address and password (encrypted)</li>
                <li>Questions you ask our AI assistant</li>
                <li>Feedback you provide (thumbs up/down)</li>
                <li>Technical manuals you upload or access</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve our AI-powered services</li>
                <li>Process your questions and deliver accurate responses</li>
                <li>Improve our AI models based on your feedback</li>
                <li>Send you technical notifications and updates</li>
                <li>Protect against fraud and abuse</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">3. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure password hashing</li>
                <li>Row-level security policies on our database</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">4. Data Sharing</h2>
              <p>
                We do not sell your personal information. We may share your data with:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>AI service providers (OpenAI) to process your questions</li>
                <li>Cloud infrastructure providers (Supabase) to store and manage data</li>
                <li>Law enforcement when required by law</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">5. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Export your data</li>
                <li>Opt-out of non-essential communications</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">6. Data Retention</h2>
              <p>
                We retain your data for as long as your account is active. After account deletion,
                we may retain certain data for legal compliance and fraud prevention purposes for
                up to 90 days.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">7. Cookies and Tracking</h2>
              <p>
                We use essential cookies for authentication and session management. We do not
                use third-party advertising or tracking cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">8. Children's Privacy</h2>
              <p>
                Our service is not intended for users under 18 years of age. We do not knowingly
                collect information from children.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">9. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any
                changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold text-primary">10. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or our data practices, please
                contact us through the support section of our application.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
