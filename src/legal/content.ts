export type LegalDoc = {
  slug: string;
  title: string;
  version: string;
  updated: string;
  body: string;
};

export const WAREHOUSE_AGREEMENT: LegalDoc = {
  slug: 'warehouse-agreement',
  title: 'Warehouse Partner Agreement',
  version: '1.0',
  updated: '2026-11-16',
  body: `# GAIA Warehouse Partner Agreement

Last updated: 16 November 2026 · Version 1.0

This Warehouse Partner Agreement ("Agreement") is between you ("Partner") and Darkmoor Ltd ("GAIA"), registered in Nigeria. By submitting a warehouse company registration, you accept this Agreement in full.

---

## 1. Eligibility

1.1 You must be a legally registered business entity in Nigeria with a valid CAC registration number and Tax Identification Number (TIN).

1.2 You must operate physical storage facilities within Nigeria that meet the standards in Section 6.

1.3 You must have a Nigerian bank account in the company's registered name for receiving payouts.

1.4 GAIA may reject any application at its sole discretion.

---

## 2. Fees

2.1 **Registration fee.** A one-time non-refundable fee of ₦20,000 (twenty thousand naira) is payable upon approval. Your account becomes active only after this fee is received.

2.2 **Listing fee.** Each storage unit you list carries a fee of ₦10,000 per month, charged in advance and auto-renewed. Your first listing is free for the first 30 days.

2.3 **Commission.** GAIA charges commission of 8% (eight percent) of every paid booking transacted through the platform. Commission is deducted from your share, not added to the farmer's price.

2.4 **Payment processing fees.** Third-party payment fees (currently Paystack) are deducted from the transaction before commission is calculated.

2.5 **Fee example.** For a ₦50,000 booking:
- Paystack fee: ₦850
- GAIA commission: ₦4,000
- Partner receives: ₦46,000

2.6 **Fee changes.** GAIA may change fees with 30 days' written notice. Continued use constitutes acceptance.

2.7 **Non-payment.** Failure to pay listing fees within 7 days of due date results in automatic delisting. Failure to pay registration fee within 30 days of approval results in automatic rejection.

---

## 3. Payouts

3.1 Payouts are made to the bank account on file, which must match your CAC-registered company name.

3.2 Payouts are processed within 7 business days of confirmed delivery or valid cancellation.

3.3 GAIA may withhold payouts pending dispute resolution, in cases of suspected fraud, or when required by Nigerian law.

3.4 Payouts under ₦5,000 are held until the balance exceeds ₦5,000.

---

## 4. Booking and Cancellation

4.1 Bookings become binding when the farmer's payment is confirmed.

4.2 You must accept or reject a booking within 24 hours of notification. Failure to respond results in automatic acceptance.

4.3 If you cancel a confirmed booking you agree to: refund the farmer in full, pay a ₦5,000 cancellation fee to GAIA, and accept a strike on your account.

4.4 Three cancellations within 90 days may result in suspension.

---

## 5. Farmer Cancellation

5.1 Farmers may cancel free of charge up to 48 hours before the storage start date.

5.2 Cancellations within 48 hours incur a 25% fee, split 50/50 between you and GAIA.

5.3 No refunds for cancellations after the storage start date.

---

## 6. Storage Standards

You agree to:

6.1 Maintain storage facilities that are dry, secure, pest-controlled, and suitable for the declared unit type.

6.2 Maintain temperature and humidity monitoring in units classified as cold or humidity-controlled.

6.3 Ensure 24/7 physical security including locks, access control, and where available CCTV.

6.4 Maintain valid insurance covering stored goods against fire, theft, flood, and other standard perils.

6.5 Allow GAIA or its representatives to inspect facilities on reasonable notice.

6.6 Report any incident affecting stored goods to GAIA within 24 hours.

---

## 7. Goods and Liability

7.1 **You are a bailee** under Nigerian law, holding goods on behalf of farmers.

7.2 **Loss or damage.** You are liable for loss or damage caused by your negligence or failure to meet standards in Section 6. Your liability is limited to the declared value of the goods.

7.3 **Act of God.** You are not liable for loss caused by events outside your reasonable control (fire, flood, storm, government action, civil unrest) **provided** you have maintained the insurance required in Section 6.4.

7.4 **Prohibited goods.** You may refuse to store illegal, dangerous, or perishable goods, or goods in violation of Nigerian regulations. Report suspicious goods to GAIA immediately.

7.5 **GAIA's role.** GAIA operates the platform connecting farmers to partners. GAIA is **not the bailee**, is not a party to the storage contract, and is not liable for physical goods. Any claim for loss of goods must be brought against the partner.

---

## 8. Quality and Safety

8.1 Ensure goods of different classes are not stored in a way that causes cross-contamination.

8.2 Maintain daily records of goods received, dispatched, and stored, including batch codes, quantities (measured on receipt), dates, and any incidents.

8.3 Records must be available to GAIA, the farmer, and regulators on demand.

---

## 9. Data and Privacy

9.1 You will have access to farmers' personal information. You agree to use it solely for fulfilling storage services, not to sell or share it, and to comply with the Nigeria Data Protection Act 2023.

9.2 GAIA is the data controller; you are a data processor.

---

## 10. Prohibited Activities

You will not:

10.1 sublet or re-lease GAIA bookings to third parties;

10.2 store goods for parties who did not book through GAIA;

10.3 offer special pricing to farmers who found you through GAIA in an attempt to circumvent the platform;

10.4 misrepresent your capacity, facilities, or credentials;

10.5 use GAIA's name, logo, or branding without written permission.

---

## 11. Suspension and Termination

11.1 GAIA may suspend or terminate your account immediately if you breach this Agreement, fail to maintain standards, commit fraud, violate Nigerian law, or receive 3+ valid complaints in 90 days.

11.2 You may terminate at any time with 30 days' notice, but must honour all confirmed bookings.

11.3 On termination, any outstanding payout will be released within 60 days, subject to disputes.

11.4 Termination does not relieve you of liability for goods already stored.

---

## 12. Dispute Resolution

12.1 Disputes between farmers and partners are first mediated by GAIA.

12.2 If mediation fails, disputes proceed to negotiation, then binding arbitration under the Arbitration and Mediation Act 2023 (Nigeria).

12.3 Governing law is that of the Federal Republic of Nigeria.

12.4 Venue for court proceedings is Lagos, Nigeria.

---

## 13. Changes

13.1 GAIA may modify this Agreement with 30 days' notice.

13.2 Continued use after notice constitutes acceptance.

13.3 Material changes require express acceptance via in-app prompt.

---

## 14. Contact

Darkmoor Ltd
Email: legal@darkmoor.com
`
};

export const TERMS_OF_SERVICE: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  version: '1.0',
  updated: '2026-11-16',
  body: `# GAIA Terms of Service

Last updated: 16 November 2026 · Version 1.0

These Terms govern your use of the GAIA platform operated by Darkmoor Ltd, registered in Nigeria. By creating an account you accept these Terms in full.

---

## 1. Definitions

"Platform" means the GAIA mobile app and website. "User" means any person using the Platform. "Services" means all functionality including marketplace, logistics, storage, and compliance tools.

---

## 2. Eligibility

2.1 You must be at least 18 years old and legally capable of entering contracts.

2.2 Businesses must be validly registered in Nigeria.

2.3 GAIA may refuse service to anyone at any time.

---

## 3. Account

3.1 You are responsible for keeping your password secure and for all activity under your account.

3.2 You must provide accurate information and keep it updated.

3.3 Notify GAIA immediately of unauthorized access.

3.4 You may not transfer or sell your account.

---

## 4. Acceptable Use

You will not:

4.1 violate any Nigerian law;

4.2 post false, misleading, or defamatory content;

4.3 impersonate any person or entity;

4.4 interfere with the Platform's operation or security;

4.5 harvest or scrape user data;

4.6 use the Platform for money laundering, terrorism financing, or fraud;

4.7 upload malware or attempt unauthorized access;

4.8 abuse the dispute or refund systems.

---

## 5. Marketplace

5.1 Sellers warrant they have legal title to goods they list.

5.2 Buyers agree to pay the listed price plus applicable fees.

5.3 GAIA is a platform, not a party to transactions between users.

5.4 GAIA may remove any listing that violates these Terms.

---

## 6. Logistics

6.1 Drivers warrant they hold valid licenses and vehicles are roadworthy.

6.2 Drivers must carry insurance as required by Nigerian law.

6.3 GAIA is not liable for goods carried by independent drivers.

---

## 7. Storage

7.1 Warehouse partners warrant they meet the standards in the Warehouse Partner Agreement.

7.2 Storage contracts are between farmers and warehouse partners.

7.3 GAIA provides dispatch and payment infrastructure only.

---

## 8. Fees

8.1 Fees are disclosed in the relevant Partner Agreement.

8.2 Fees may change with 30 days' notice.

8.3 Applicable taxes are your responsibility unless stated otherwise.

---

## 9. Intellectual Property

9.1 GAIA owns all rights to the Platform and its content.

9.2 You retain ownership of content you upload.

9.3 By uploading content you grant GAIA a non-exclusive, worldwide, royalty-free license to use it to operate the Platform.

---

## 10. Disclaimers

10.1 The Platform is provided "as is" without warranties of any kind.

10.2 GAIA does not warrant that the Platform will be uninterrupted or error-free.

10.3 GAIA does not guarantee the quality, safety, or legality of any goods or services offered by third parties.

---

## 11. Limitation of Liability

11.1 To the maximum extent permitted by Nigerian law, GAIA's total liability to you shall not exceed the greater of ₦50,000 or the fees you paid in the 12 months preceding the claim.

11.2 GAIA is not liable for indirect, incidental, special, or consequential damages.

11.3 Nothing in these Terms limits liability for fraud, death, or personal injury caused by negligence.

---

## 12. Indemnity

You agree to indemnify GAIA against all losses, claims, damages, and expenses arising from your use of the Platform or breach of these Terms.

---

## 13. Termination

13.1 You may close your account at any time.

13.2 GAIA may suspend or terminate your account for breach of these Terms, fraud, or legal requirements.

13.3 Sections 8, 9, 11, 12 survive termination.

---

## 14. Governing Law

14.1 These Terms are governed by the laws of the Federal Republic of Nigeria.

14.2 Disputes are resolved by negotiation, then binding arbitration under the Arbitration and Mediation Act 2023.

14.3 Venue for court proceedings is Lagos, Nigeria.

---

## 15. Contact

Darkmoor Ltd · legal@darkmoor.com
`
};

export const PRIVACY_POLICY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  version: '1.0',
  updated: '2026-11-16',
  body: `# GAIA Privacy Policy

Last updated: 16 November 2026 · Version 1.0

This Privacy Policy explains how Darkmoor Ltd ("GAIA") collects, uses, and protects your personal data under the Nigeria Data Protection Act 2023 (NDPA) and other applicable law.

---

## 1. Data Controller

Darkmoor Ltd, registered in Nigeria, is the data controller for all personal data processed through the GAIA platform.

Data Protection Officer: dpo@darkmoor.com

---

## 2. What We Collect

2.1 **Identity data:** name, phone, email, state, LGA, address, date of birth.

2.2 **Identity verification:** BVN, NIN, driver's license, CAC registration, TIN, government-issued IDs (encrypted at rest).

2.3 **Financial data:** bank name, account number, account name, transaction history.

2.4 **Location data:** GPS coordinates when you use location-enabled features. Collected only while you are using the feature (or online as a driver).

2.5 **Usage data:** device type, OS, app version, log data, IP address.

2.6 **Content data:** photos, voice recordings, and messages you upload or send through the platform.

2.7 **Compliance data:** KYC/AML records required by Nigerian law.

---

## 3. Why We Collect It

3.1 To provide the Platform's services (matching, dispatch, payments, storage booking).

3.2 To verify identity as required by CBN and other Nigerian regulators.

3.3 To prevent fraud and comply with anti-money-laundering law.

3.4 To send transactional notifications and (with your consent) marketing.

3.5 To improve the Platform through aggregated analytics.

3.6 To respond to legal requests and enforce our Terms.

---

## 4. Legal Basis

We rely on:

- **Contract** for the data required to deliver services you have requested.
- **Legal obligation** for KYC, AML, tax, and regulatory records.
- **Legitimate interest** for fraud prevention, security, and platform improvement.
- **Consent** for marketing and optional features.

---

## 5. Who We Share With

5.1 **Payment processors** (Paystack) to process transactions.

5.2 **KYC providers** (Dojah, Verify.ng, or similar) for identity verification.

5.3 **Cloud infrastructure** (Supabase, AWS, Google Cloud) as data processors under written agreements.

5.4 **Regulators** (CBN, FIRS, NDPC) when legally required.

5.5 **Law enforcement** on valid legal request.

5.6 **Successor entities** in case of merger or acquisition (with notice).

We do not sell your personal data.

---

## 6. Retention

6.1 Transaction records: 7 years (Nigerian tax requirement).

6.2 KYC records: 5 years after account closure (AML requirement).

6.3 Usage data: 24 months.

6.4 Marketing consent: until withdrawn.

6.5 Chat messages: 24 months, then archived or deleted.

---

## 7. Your Rights (NDPA)

You have the right to:

7.1 **Access** your personal data.

7.2 **Correct** inaccurate data.

7.3 **Delete** data where we no longer have a lawful basis.

7.4 **Restrict** processing in certain circumstances.

7.5 **Port** your data to another service.

7.6 **Object** to processing based on legitimate interest.

7.7 **Withdraw consent** for marketing at any time.

To exercise any right, email dpo@darkmoor.com. We respond within 30 days.

You may also complain to the Nigeria Data Protection Commission (NDPC).

---

## 8. Security

8.1 We use industry-standard encryption (TLS in transit, encryption at rest).

8.2 Access to personal data is restricted to authorized personnel under NDA.

8.3 We conduct regular security reviews and penetration tests.

8.4 No system is perfectly secure; you use the Platform at your own risk.

---

## 9. International Transfers

Some of our processors (Supabase, AWS) may store data outside Nigeria. Transfers use Standard Contractual Clauses or are to countries with adequate data protection as recognized by the NDPC.

---

## 10. Children

The Platform is not for anyone under 18. We do not knowingly collect data from children. Contact dpo@darkmoor.com if you believe a child has provided data.

---

## 11. Changes

We will notify you of material changes via email or in-app notification at least 30 days in advance.

---

## 12. Contact

Darkmoor Ltd · dpo@darkmoor.com · legal@darkmoor.com
`
};

export const REFUND_POLICY: LegalDoc = {
  slug: 'refunds',
  title: 'Refund Policy',
  version: '1.0',
  updated: '2026-11-16',
  body: `# GAIA Refund Policy

Last updated: 16 November 2026 · Version 1.0

---

## 1. Storage Bookings

1.1 Cancellations more than 48 hours before start date: full refund.

1.2 Cancellations within 48 hours of start date: 75% refund (25% split between partner and GAIA).

1.3 Cancellations after start date: no refund.

1.4 Partner-cancelled bookings: full refund + ₦5,000 partner cancellation fee.

---

## 2. Marketplace Orders

2.1 Buyer may cancel before seller dispatches: full refund.

2.2 After dispatch: buyer must accept delivery or raise a dispute within 48 hours.

2.3 Valid disputes (goods not as described, damaged in transit): full or partial refund determined by GAIA.

2.4 Frivolous disputes may result in loss of dispute privileges.

---

## 3. Listing Fees

3.1 Listing fees are non-refundable once the unit is listed.

3.2 If GAIA removes a listing in error, you receive a pro-rata credit.

3.3 If you voluntarily unlist within the paid period, the remainder is not refunded.

---

## 4. Registration Fees

4.1 The ₦20,000 warehouse registration fee is non-refundable.

4.2 If GAIA rejects your application after you paid, the fee is refunded within 14 days.

---

## 5. Processing

5.1 Refunds are returned to the original payment method.

5.2 Processing takes 5-10 business days.

5.3 GAIA is not responsible for delays by your bank.

---

## 6. Disputes

Raise a refund request from the app's Support tab, or email legal@darkmoor.com with the transaction reference. We respond within 5 business days.
`
};

export const DRIVER_AGREEMENT: LegalDoc = {
  slug: 'driver-agreement',
  title: 'Driver Agreement',
  version: '1.0',
  updated: '2026-11-16',
  body: `# GAIA Driver Agreement

Last updated: 16 November 2026 · Version 1.0

This Driver Agreement is between you ("Driver") and Darkmoor Ltd ("GAIA"). By registering as a driver, you accept it in full.

---

## 1. Eligibility

1.1 You must be at least 21 years old.

1.2 You must hold a valid Nigerian driver's license for the vehicle class you operate.

1.3 Your vehicle must be roadworthy, insured, and registered in Nigeria.

1.4 You must pass background and identity verification.

---

## 2. Independent Contractor

2.1 You are an independent contractor, not an employee, agent, or partner of GAIA.

2.2 You control when and where you work.

2.3 You are responsible for your own taxes, pension, and insurance.

2.4 Nothing in this Agreement creates an employment relationship.

---

## 3. Platform Role

3.1 GAIA provides technology to match you with cargo delivery jobs.

3.2 GAIA is not party to the delivery contract between you and the shipper.

3.3 GAIA does not guarantee job volume.

---

## 4. Fees

4.1 GAIA charges commission on each completed delivery, deducted from the delivery fee shown in the app.

4.2 Commission rates are displayed before you accept any job.

4.3 Payouts are made to your verified bank account.

4.4 Payouts are processed after the receiver confirms delivery.

---

## 5. Conduct

You will:

5.1 handle cargo with reasonable care;

5.2 arrive at pickup within the agreed window;

5.3 complete delivery within the agreed window unless prevented by events outside your control;

5.4 maintain civil conduct with shippers and receivers;

5.5 report incidents (accidents, theft, breakdowns) immediately via the app's SOS feature;

5.6 not carry unauthorized passengers or cargo;

5.7 not use the Platform while under the influence of alcohol or drugs.

---

## 6. Cargo Loss and Damage

6.1 If cargo is lost or damaged in transit due to your negligence, your liability is limited to the declared value of the goods, provided you cooperated fully with GAIA's investigation.

6.2 GAIA may withhold payouts to cover verified claims.

6.3 You should maintain your own cargo insurance.

---

## 7. Ratings and Suspension

7.1 Shippers may rate you after each delivery.

7.2 A sustained average below 3.5 stars may result in review.

7.3 GAIA may suspend your account for breach of this Agreement, fraud, safety incidents, or legal requirements.

---

## 8. Termination

8.1 You may stop driving at any time by going offline.

8.2 You may close your account by contacting support.

8.3 GAIA may terminate your access per Section 7.3.

8.4 Outstanding payouts owed to you will be released within 60 days of termination.

---

## 9. Governing Law

Nigerian law governs. Disputes follow the same arbitration procedure as the Terms of Service.

---

## 10. Contact

Darkmoor Ltd · legal@darkmoor.com
`
};

export const ALL_DOCS = [
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  WAREHOUSE_AGREEMENT,
  DRIVER_AGREEMENT,
  REFUND_POLICY,
];
