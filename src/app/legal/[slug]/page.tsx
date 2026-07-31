import { notFound } from "next/navigation";
import type { Metadata } from "next";

const COMPANY = "Proactive Clinic";
const DIVISION = "ProactiveClinics is a Division of Proactive UMS Inc.";
const ADDRESS = "8103 Bandera Rd, Suite 102, San Antonio, TX 78250";
const PHONE = "(210) 500-2914";
const EMAIL = "info@proactiveclinic.com";
const UPDATED = "January 2026";

type Section = { h: string; p: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy Policy",
    intro: `${COMPANY} ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our patient portal and services. ${DIVISION}`,
    sections: [
      { h: "Information We Collect", p: ["Personal identifiers such as name, date of birth, contact details, and medical record number (MRN).", "Health information you provide through appointment requests, the patient portal, and the AI assistant.", "Technical data such as IP address, browser type, and usage information collected via cookies and similar technologies."] },
      { h: "How We Use Your Information", p: ["To provide and coordinate your care, schedule and confirm appointments, and operate the patient portal.", "To communicate with you about your care, respond to requests, and improve our services.", "To comply with legal, regulatory, and HIPAA obligations."] },
      { h: "How We Share Information", p: ["We share protected health information (PHI) only as permitted by HIPAA — for treatment, payment, and health care operations, or with your authorization.", "We do not sell your personal information. Service providers who support our operations are bound by confidentiality and data-protection obligations."] },
      { h: "Data Security", p: ["We use administrative, technical, and physical safeguards designed to protect your information. No method of transmission or storage is 100% secure, but we work to protect your data using industry-standard measures."] },
      { h: "Your Choices & Rights", p: ["You may request access to, correction of, or a copy of your information, subject to applicable law. To exercise your rights, contact us using the details below."] },
      { h: "Contact Us", p: [`If you have questions about this Privacy Policy, contact us at ${ADDRESS}, ${PHONE}, or ${EMAIL}.`] },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: `These Terms of Use govern your access to and use of the ${COMPANY} website, patient portal, and related services. By using our services you agree to these terms. ${DIVISION}`,
    sections: [
      { h: "Use of Services", p: ["Our website and portal are provided for informational and care-coordination purposes. You agree to use them lawfully and to provide accurate information.", "You are responsible for maintaining the confidentiality of your login credentials."] },
      { h: "No Medical Emergency Use", p: ["Our website, portal, and AI assistant are NOT for medical emergencies. If you are experiencing an emergency, call 911 or go to the nearest emergency room immediately."] },
      { h: "Not a Substitute for Professional Advice", p: ["Content and AI-assistant responses are for general information only and do not constitute medical advice, diagnosis, or treatment. Always consult a qualified provider for medical decisions."] },
      { h: "Intellectual Property", p: ["All content, logos, and materials are owned by Proactive UMS Inc. or its licensors and may not be reproduced without permission."] },
      { h: "Limitation of Liability", p: ["To the fullest extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the services."] },
      { h: "Contact Us", p: [`Questions about these Terms? Contact ${ADDRESS}, ${PHONE}, or ${EMAIL}.`] },
    ],
  },
  hipaa: {
    title: "HIPAA Notice of Privacy Practices",
    intro: `This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully. ${DIVISION}`,
    sections: [
      { h: "Our Commitment", p: ["We are required by the Health Insurance Portability and Accountability Act (HIPAA) to maintain the privacy of your protected health information (PHI), provide you this notice of our legal duties and privacy practices, and follow the terms of the notice currently in effect."] },
      { h: "How We May Use and Disclose PHI", p: ["Treatment: to provide, coordinate, or manage your health care and related services.", "Payment: to bill and collect payment for the care you receive.", "Health Care Operations: for quality assessment, staff training, and administrative activities.", "As Required by Law: when disclosure is required by federal, state, or local law."] },
      { h: "Your Health Information Rights", p: ["You have the right to inspect and obtain a copy of your PHI, request amendments, request an accounting of certain disclosures, request restrictions, and request confidential communications.", "You may revoke an authorization in writing at any time, except to the extent we have already acted on it."] },
      { h: "Filing a Complaint", p: ["If you believe your privacy rights have been violated, you may file a complaint with us or with the U.S. Department of Health and Human Services. We will not retaliate against you for filing a complaint."] },
      { h: "Contact Us", p: [`To exercise your rights or ask questions, contact our Privacy Officer at ${ADDRESS}, ${PHONE}, or ${EMAIL}.`] },
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    intro: `${COMPANY} is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards. ${DIVISION}`,
    sections: [
      { h: "Our Approach", p: ["We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. Our team reviews color contrast, keyboard navigation, and screen-reader compatibility."] },
      { h: "In-Person Accommodations", p: ["Our San Antonio clinic offers accessible facilities. If you need an accommodation for your visit, please let us know in advance."] },
      { h: "Feedback", p: [`If you encounter an accessibility barrier, please contact us at ${PHONE} or ${EMAIL} so we can assist and improve.`] },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: `This Cookie Policy explains how ${COMPANY} uses cookies and similar technologies on our website. ${DIVISION}`,
    sections: [
      { h: "What Are Cookies", p: ["Cookies are small text files stored on your device that help websites function and remember your preferences."] },
      { h: "How We Use Cookies", p: ["Essential cookies enable core functionality such as secure login sessions for the patient and staff portals.", "Preference cookies remember settings such as your language choice.", "Analytics cookies help us understand how the site is used so we can improve it."] },
      { h: "Managing Cookies", p: ["You can accept or decline non-essential cookies via our cookie banner, and you can control cookies through your browser settings. Disabling essential cookies may affect portal functionality."] },
      { h: "Contact Us", p: [`Questions about cookies? Contact ${ADDRESS}, ${PHONE}, or ${EMAIL}.`] },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS[slug];
  return { title: doc ? `${doc.title} | ${COMPANY}` : "Legal | Proactive Clinic" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <p className="text-sm font-bold text-brand-700 uppercase tracking-wider">Compliance</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-900">{doc.title}</h1>
      <p className="mt-2 text-xs text-slate-400">Last updated: {UPDATED}</p>
      <p className="mt-6 text-slate-600 leading-relaxed">{doc.intro}</p>

      <div className="mt-8 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-bold text-brand-900">{s.h}</h2>
            <div className="mt-2 space-y-2">
              {s.p.map((para, i) => (
                <p key={i} className="text-sm text-slate-600 leading-relaxed">{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-brand-100 bg-brand-50 p-5 text-sm text-slate-600">
        <div className="font-semibold text-brand-900">Proactive Clinic — A Division of Proactive UMS Inc.</div>
        <div className="mt-1">{ADDRESS}</div>
        <div>{PHONE} · {EMAIL}</div>
      </div>
    </article>
  );
}
