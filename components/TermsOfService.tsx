import React from 'react';

const TermsOfService: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-8 md:p-16">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="mb-12 border-b border-white/10 pb-8">
                    <h1 className="text-4xl font-black text-white mb-2">Terms of Service</h1>
                    <p className="text-sm text-slate-500 uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using Aura Domo Sketch, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">2. Use of Service</h2>
                    <p>
                        You agree to use our AI generation tools responsibly. You must not use the service to generate content that is illegal, harmful, threatening, or violates the rights of others.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">3. Intellectual Property</h2>
                    <p>
                        You retain ownership of the original sketches you create. However, the AI-generated outputs are subject to our licensing agreements and the terms of the underlying AI models.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">4. Payment & Subscriptions</h2>
                    <p>
                        Some features of the Service require payment. You agree to provide accurate billing information and authorize us to charge your payment method for any paid features or subscriptions.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">5. Termination</h2>
                    <p>
                        We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">6. Limitation of Liability</h2>
                    <p>
                        In no event shall Aura Domo Sketch be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">7. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default TermsOfService;
