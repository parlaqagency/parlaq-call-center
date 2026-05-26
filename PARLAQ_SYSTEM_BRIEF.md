# PARLAQ AJANS — AI Receptionist System Brief
> Use this document to get full context on the product, business model, and target market.

---

## Who We Are

**PARLAQ AJANS** — an AI automation agency based in Turkey. We build and sell AI-powered receptionist systems for dental clinics. We handle everything: setup, training the AI on the clinic's specific services/pricing, and ongoing support.

---

## The Product: AI Receptionist

An AI voice agent that answers every incoming call to the dental clinic — 24/7, including nights, weekends, and holidays. It speaks naturally (not robotic), knows the clinic's services and pricing, and handles the full appointment booking flow autonomously.

### What It Does (Full Feature List)

1. **Answers every call** — No missed calls, ever. The AI picks up instantly.
2. **Knows the clinic** — Trained on the clinic's specific services, treatments, pricing, doctors, and working hours.
3. **Books appointments** — Collects patient name, phone, email → saves to the clinic's calendar. Checks for availability in real-time, no double-bookings.
4. **Sends confirmation** — Automatic WhatsApp or SMS confirmation sent to the patient after booking.
5. **Reminder call/message** — Automated reminder sent 1 hour before the appointment (call or message).
6. **Post-treatment Google review redirect** — After the appointment, sends an automated message directing the patient to leave a Google review.
7. **No-show recovery** — If a patient misses their appointment, the AI automatically calls them back: *"We noticed you missed your appointment — would you like to reschedule?"* and books a new slot.

### Optional Add-ons

- **Website** — Professional clinic website for clinics that don't have one.
- **Online Booking System** — Patients can book appointments online 24/7 via the website or a direct link. Fully integrated with the same calendar — if a slot is taken, it can't be double-booked. Works alongside the AI receptionist.

---

## The Problem We Solve

Dental clinics miss calls constantly — during busy hours, lunch breaks, after hours, when the receptionist is with a patient. Each missed call is a potential patient going to a competitor.

**The math:**
- Average dental treatment value: ~£500–£2,000 (UK) / $500–$3,000 (US)
- Missed calls per day (average clinic): 4–6
- Monthly revenue lost to missed calls: **£10,000–£30,000+**
- Our system costs: **£250/month**
- ROI: recovering even 1–2 patients per month more than covers the cost

---

## Pricing (UK / US Market)

> Pricing is flexible for international markets. Below are suggested equivalents based on our Turkey pricing. Adjust based on market.

| Product | One-Time Setup | Monthly |
|---|---|---|
| AI Receptionist | £250 | £250/month |
| Website | £125 | — |
| Online Booking System | £125 | — |
| **Full Package (all 3)** | **£375 setup** | **£250/month** |

> **Note:** In our Turkey market we charge 10,000 TL setup + 10,000 TL/month for AI Receptionist, 5,000 TL each for Website and Online Booking. The GBP/USD figures above are approximate conversions — adjust based on what the market bears. The ROI argument stays the same.

---

## Sales Approach — UK/US Market

### Channel: Email Marketing (Cold Outreach)
- Source leads from Apify (Google Places scraper — dental clinics in UK/US cities)
- Send cold emails with a compelling subject line and short pitch
- Include a demo video link (90 seconds showing the system in action)
- CTA: Book a Google Meet / reply for more info

### Follow-up
- If no reply in 3–4 days: follow-up email
- Interested leads → Google Meet demo call
- On the call: show the live demo, answer questions, close

---

## Cold Email Structure (Suggested)

**Subject options:**
- "Your clinic is losing £X,XXX/month to missed calls"
- "AI receptionist for [Clinic Name] — never miss a patient call again"
- "We built something for dental clinics like yours"

**Body (short version):**
> Hi [Name],
>
> Quick question — what happens when a patient calls your clinic after hours, or when your receptionist is busy?
>
> Most dental clinics lose 4–6 bookings per day to missed calls. At £[avg treatment value], that's £[X] per month walking out the door.
>
> We built an AI receptionist that answers every call, 24/7 — books appointments, sends confirmations, and even calls back no-shows automatically.
>
> I put together a 90-second demo showing exactly how it works for a dental clinic. Worth a watch?
>
> [WATCH DEMO →]
>
> Happy to jump on a 15-min Google Meet to walk you through it.
>
> Best,
> [Name] | PARLAQ

---

## Objection Handling

| Objection | Response |
|---|---|
| "We already have a receptionist" | "Great — the AI handles after-hours, lunch breaks, and overflow. It doesn't replace your receptionist, it fills the gaps." |
| "I don't trust AI" | "Completely fair. That's why we show you the demo first — 90 seconds, you'll see exactly how it sounds and works for a dental clinic. No commitment." |
| "We're too busy" | "That's exactly why it makes sense — the busier you are, the more calls you're missing. The AI handles the overflow automatically." |
| "Too expensive" | "If it recovers one extra booking per month, it pays for itself. Most clinics recover 10–20 extra bookings in the first month." |
| "We don't need it" | "Totally understand. If you're curious, I can show you what it looks like for a clinic similar to yours — takes 15 mins on a call." |

---

## Tech Stack (for reference)

- **AI voice:** TBD (evaluating Vapi, Bland.ai, ElevenLabs + Twilio — needs to sound natural in target language)
- **Automation:** N8N (all workflows — booking, reminders, follow-ups, Google review redirects)
- **Calendar:** Google Calendar (or clinic's existing calendar if compatible)
- **CRM/Leads Tracker:** Custom-built internal tool (parlaq-leads-tracker.vercel.app)
- **Confirmations:** WhatsApp Business API or SMS (Twilio)

---

## Key Selling Points (Summary)

1. **Never miss a call again** — 24/7 coverage including nights and weekends
2. **Pays for itself** — recovering 1–2 extra patients/month covers the cost
3. **Fully automated** — clinic staff don't need to do anything differently
4. **Clinic-specific** — AI is trained on their exact services, prices, and schedule
5. **No long-term contract required** — monthly subscription, cancel anytime
6. **Add-ons available** — website + online booking for clinics that want the full package

---

## What You Need to Know for This Task

- Target: **Dental clinics in UK and USA** (sourced from Apify Google Places scraper)
- Goal: **Cold email outreach** → get replies → book Google Meet
- The email should be short, punchy, ROI-focused
- Include a demo video CTA (video will be created separately)
- Tone: professional but conversational, not corporate/stiff
- The system is real and working — frame it as an established product, not a startup pitch
