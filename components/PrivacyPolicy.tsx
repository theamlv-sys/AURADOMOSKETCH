import React from 'react';

const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-8 md:p-16">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="mb-12 border-b border-white/10 pb-8">
                    <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
                    <p className="text-sm text-slate-500 uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>
                </header>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">1. Introduction</h2>
                    <p>
                        Welcome to Aura Domo Sketch ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                        This Privacy Policy explains how we collect, use, and share your information when you use our application.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">2. Information Collection</h2>
                    <p>We collect the following types of information:</p>
                    <ul className="list-disc pl-5 space-y-2 text-slate-400">
                        <li><strong>Authentication Data:</strong> When you sign in with Google, we collect your email address and profile name to manage your account.</li>
                        <li><strong>Usage Data:</strong> We may collect anonymous data about how you interact with our tools to improve performance.</li>
                        <li><strong>Local Storage:</strong> Your sketches and preferences are stored locally on your device's browser storage ("Local Storage"). We do not automatically upload or store your raw sketches on our servers unless you explicitly save or share them.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">3. How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul className="list-disc pl-5 space-y-2 text-slate-400">
                        <li>Provide, operate, and maintain our application.</li>
                        <li>Process transactions and manage your user account.</li>
                        <li>Detect and prevent fraudulent usage.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">4. Data Sharing</h2>
                    <p>
                        We do not sell your personal data. We may share data with third-party service providers (such as Google for authentication or Stripe for payments) solely to provide the necessary services.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">5. Your Rights</h2>
                    <p>
                        You have the right to access, update, or delete your personal information. You can typically do this directly within your account settings or by contacting us.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide">6. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us at auraassistantai@auradomo.com.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
