import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CircleCheck,
  Clock,
  EyeOff,
  FileSpreadsheet,
  Moon,
  Repeat,
  Send,
  Timer,
  UserX,
} from "lucide-react";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "RosterHouse — shift scheduling for hourly teams",
  description:
    "Build the week on one grid, catch conflicts before they hit the floor, and put every shift on your team's phones. Free to start, no credit card.",
};

function Avatar({ initials, tone }: { initials: string; tone?: "amber" }) {
  return (
    <span className={`${s.avatar} ${tone === "amber" ? s.avatarAmber : ""}`}>
      {initials}
    </span>
  );
}

function ConflictChip({ children }: { children: React.ReactNode }) {
  return (
    <span className={s.conflictChip}>
      <AlertTriangle size={12} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do my employees need to download an app?",
    a: "No. When you publish, they get a text with a link that opens in their phone’s browser. Any phone that can open a web page works — no app store, no updates, no passwords taped to the register.",
  },
  {
    q: "How much does it cost?",
    a: "It’s free to start, and you don’t need a credit card to sign up. Paid plans aren’t published yet — while we’re early, everything on this page is included. You’ll get plain notice before anything changes.",
  },
  {
    q: "How long does setup take?",
    a: "About as long as writing out one week’s schedule by hand. Add your team’s names and phone numbers, build the week on the grid, and publish. You can go from signup to a published schedule in one sitting.",
  },
  {
    q: "What happens if I schedule someone who isn’t available?",
    a: "The grid warns you before you publish — something specific, like “Overlaps Maria’s 2:00 PM–6:00 PM shift” or “Outside Sam’s availability on Tuesdays.” Warnings don’t block you. You can fix the shift or keep it on purpose.",
  },
  {
    q: "Can my team swap shifts without asking me?",
    a: "They can request a swap from their phone, but nothing changes until you approve it. You see who’s asking, who’s covering, and any conflicts the swap would cause.",
  },
  {
    q: "What happens when the schedule changes after I publish?",
    a: "Edit the shift and publish again. Anyone affected gets a text with the update — no reprinting, no chasing people down.",
  },
  {
    q: "My team isn’t good with technology. Will this work for them?",
    a: "If they can open a text message, they can use RosterHouse. There’s one screen with their shifts on it, and the buttons say what they do — “Clock in,” “Request swap.” Nothing to set up on their end beyond tapping the link.",
  },
];

export default function Home() {
  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.navInner}>
          <span className={s.wordmark}>RosterHouse</span>
          <nav className={s.navLinks} aria-label="Page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#for-your-team">For your team</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={s.navActions}>
            <Link href="/login" className={s.btnGhost}>
              Log in
            </Link>
            <Link href="/signup" className={s.btnPrimary}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>Shift scheduling for hourly teams</p>
            <h1 className={s.h1}>Get the schedule out of the group chat</h1>
            <p className={s.subhead}>
              RosterHouse is one place to build the week, catch conflicts
              before they hit the floor, and put every shift on your team’s
              phones. Nothing for them to install — they tap a text and see
              their shifts.
            </p>
            <div className={s.ctaRow}>
              <Link href="/signup" className={s.btnPrimaryLg}>
                Start free
              </Link>
              <Link href="/login" className={s.btnGhostLg}>
                Log in
              </Link>
            </div>
            <p className={s.microcopy}>Free to start. No credit card.</p>
          </div>

          <div className={s.heroVisual} aria-hidden>
            <div className={s.gridCard}>
              <div className={s.gridToolbar}>
                <span className={s.gridTitle}>Week of Jul 6</span>
                <span className={s.pillPublished}>PUBLISHED</span>
              </div>
              <div className={s.gridScroll}>
                <div className={s.grid}>
                  <div className={s.gridCorner} />
                  <div className={s.gridDay}>Mon 6</div>
                  <div className={s.gridDay}>Tue 7</div>
                  <div className={s.gridDay}>Wed 8</div>
                  <div className={s.gridDay}>Thu 9</div>
                  <div className={s.gridDay}>Fri 10</div>

                  <div className={s.gridRole}>Front counter</div>
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="MR" />
                      <span>7:00 AM–3:00 PM</span>
                    </div>
                  </div>
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="MR" />
                      <span>7:00 AM–3:00 PM</span>
                    </div>
                  </div>
                  <div className={s.cell} />
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="JT" />
                      <span>11:00 AM–7:00 PM</span>
                    </div>
                  </div>
                  <div className={s.cell}>
                    <div className={s.shiftOpen}>
                      <span className={s.openTag}>Open shift</span>
                      <span>4:00 PM–10:00 PM</span>
                    </div>
                  </div>

                  <div className={s.gridRole}>Register</div>
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="AL" />
                      <span>12:00 PM–8:00 PM</span>
                    </div>
                  </div>
                  <div className={s.cell} />
                  <div className={s.cellConflict}>
                    <div className={s.shift}>
                      <Avatar initials="DK" />
                      <span>2:00 PM–10:00 PM</span>
                    </div>
                    <ConflictChip>
                      Overlaps Maria’s 2:00 PM–6:00 PM shift
                    </ConflictChip>
                  </div>
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="DK" />
                      <span>8:00 AM–4:00 PM</span>
                    </div>
                  </div>
                  <div className={s.cell}>
                    <div className={s.shift}>
                      <Avatar initials="AL" />
                      <span>3:00 PM–11:00 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className={s.bandSunken}>
          <div className={s.problem}>
            <div className={s.problemCopy}>
              <h2 className={s.h2}>Sunday night, again</h2>
              <p className={s.body}>
                The schedule lives in a spreadsheet only you can edit. You post
                a photo of it in the group chat. By Tuesday it’s buried under
                forty messages. Wednesday, someone doesn’t show — they say they
                never saw it. You cover the shift yourself, and next Sunday you
                start the whole thing over from a blank grid.
              </p>
            </div>
            <div className={s.chatMock} aria-hidden>
              <div className={s.chatHeader}>
                <span>The group chat, Tuesday</span>
                <span className={s.chatBadge}>47</span>
              </div>
              <div className={s.chatBubble}>Who’s closing Friday?</div>
              <div className={s.chatBubble}>Is the new schedule up?</div>
              <div className={s.chatBubble}>
                Can anyone take my 2:00 PM–10:00 PM tomorrow?
              </div>
              <div className={s.chatBubbleLoud}>I never saw it.</div>
            </div>
          </div>

          <div className={s.painCards}>
            <div className={s.painCard}>
              <FileSpreadsheet className={s.painIcon} strokeWidth={1.5} />
              <h3 className={s.h3}>The photo of the spreadsheet</h3>
              <p className={s.bodySm}>
                Posted Sunday. Buried by Tuesday. Edited Wednesday. Nobody has
                the current version, including you.
              </p>
            </div>
            <div className={s.painCard}>
              <UserX className={s.painIcon} strokeWidth={1.5} />
              <h3 className={s.h3}>The no-show</h3>
              <p className={s.bodySm}>
                “I never saw the schedule.” Maybe true. You can’t prove it
                either way, and the shift is still empty.
              </p>
            </div>
            <div className={s.painCard}>
              <Moon className={s.painIcon} strokeWidth={1.5} />
              <h3 className={s.h3}>The Sunday rebuild</h3>
              <p className={s.bodySm}>
                Every week starts from scratch because this week’s requests
                live in six different text threads.
              </p>
            </div>
          </div>
        </section>

        {/* Build the week */}
        <section className={s.featureRow}>
          <div className={s.featureCopy}>
            <h2 className={s.h2}>Build the week on one grid</h2>
            <p className={s.body}>
              Drag shifts onto a week grid in your browser. RosterHouse checks
              every assignment against availability, time off, and overtime as
              you go — so problems surface while you’re building, not when
              someone’s double-booked on a Friday night.
            </p>
            <ul className={s.checklist}>
              <li>
                <Calendar className={s.checkIcon} strokeWidth={1.5} />
                <span>
                  <strong>One screen for the whole week.</strong> Drag, drop,
                  and see coverage for Monday through Sunday at a glance.
                </span>
              </li>
              <li>
                <AlertTriangle className={s.checkIcon} strokeWidth={1.5} />
                <span>
                  <strong>Warnings that name the problem.</strong> Not
                  “conflict detected” — “Overlaps Maria’s 2:00 PM–6:00 PM
                  shift,” the moment it happens.
                </span>
              </li>
              <li>
                <EyeOff className={s.checkIcon} strokeWidth={1.5} />
                <span>
                  <strong>Draft until you say so.</strong> The schedule stays
                  private while you work. Nobody sees a half-finished week.
                </span>
              </li>
            </ul>
          </div>
          <div className={s.featureVisual} aria-hidden>
            <div className={s.specimenCard}>
              <ConflictChip>Overlaps Maria’s 2:00 PM–6:00 PM shift</ConflictChip>
              <ConflictChip>Outside Sam’s availability on Tuesdays</ConflictChip>
              <ConflictChip>Puts Dee at 46 hrs this week</ConflictChip>
              <p className={s.caption}>
                Warnings don’t block you. They just don’t let you miss it.
              </p>
            </div>
            <div className={s.toolbarMock}>
              <span className={s.btnMockSecondary}>Save draft</span>
              <span className={s.btnMockPrimary}>Publish week</span>
            </div>
          </div>
        </section>

        {/* Publish */}
        <section className={`${s.featureRow} ${s.featureRowFlip}`}>
          <div className={s.featureCopy}>
            <h2 className={s.h2}>Publish once. Every phone gets it.</h2>
            <p className={s.body}>
              Hit publish and your whole team gets notified — a push or a
              text, straight to the phone already in their pocket. The
              schedule lives at one link, always current. No photo of a
              printout from three edits ago, and no “I never saw it.” When
              something changes, you publish the update and everyone is
              looking at the same week.
            </p>
            <div className={s.toast} aria-hidden>
              <CircleCheck className={s.toastIcon} strokeWidth={1.75} />
              <span>Schedule published. 12 people notified.</span>
            </div>
          </div>
          <div className={s.featureVisual} aria-hidden>
            <div className={s.flow}>
              <div className={s.flowGrid}>
                <span className={s.gridTitle}>Week of Jul 6</span>
                <span className={s.pillPublished}>PUBLISHED</span>
              </div>
              <div className={s.flowConnector}>
                <Send size={14} strokeWidth={1.75} />
              </div>
              <div className={s.phoneCard}>
                <div className={s.phoneHeader}>
                  <Avatar initials="MR" />
                  <span>My shifts</span>
                </div>
                <div className={s.phoneRow}>
                  <span>Tue · 7:00 AM–3:00 PM</span>
                  <span className={s.phoneRole}>Front counter</span>
                </div>
                <div className={s.phoneRow}>
                  <span>Thu · 12:00 PM–8:00 PM</span>
                  <span className={s.phoneRole}>Register</span>
                </div>
                <p className={s.phoneFooter}>You’re all set for this week</p>
              </div>
            </div>
          </div>
        </section>

        {/* For your team */}
        <section className={s.bandSunken} id="for-your-team">
          <div className={s.centerHead}>
            <h2 className={s.h2}>Easy for your team, or it doesn’t work</h2>
            <p className={s.body}>
              If the tool is harder than texting you, your team won’t touch
              it. RosterHouse runs in the phone browser they already have —
              you add a phone number, they get a text with a link, and their
              shifts are on the screen. No app store, no installs, no
              passwords taped to the register.
            </p>
          </div>
          <div className={s.teamGrid}>
            <div className={s.teamCard}>
              <span className={s.teamIconWrap}>
                <CalendarCheck strokeWidth={1.5} />
              </span>
              <h3 className={s.h3}>Their shifts, always current</h3>
              <p className={s.bodySm}>
                The week ahead in one tap. No scrolling through messages to
                find a photo.
              </p>
            </div>
            <div className={s.teamCard}>
              <span className={s.teamIconWrap}>
                <Clock strokeWidth={1.5} />
              </span>
              <h3 className={s.h3}>Availability up front</h3>
              <p className={s.bodySm}>
                They mark the hours they can work. You see it right on the
                grid while you build, before you assign the wrong person.
              </p>
            </div>
            <div className={s.teamCard}>
              <span className={s.teamIconWrap}>
                <Repeat strokeWidth={1.5} />
              </span>
              <h3 className={s.h3}>Swaps you approve</h3>
              <p className={s.bodySm}>
                Sick kid, dead car — someone offers up a shift, a teammate
                takes it, and you get the final say. Nothing changes on the
                schedule until you say yes.
              </p>
              <div className={s.swapMock} aria-hidden>
                <span className={s.swapAvatars}>
                  <Avatar initials="JT" />
                  <Avatar initials="AL" tone="amber" />
                </span>
                <span>Sat 5:00 PM–11:00 PM</span>
                <span className={s.pillWaiting}>Waiting on you</span>
              </div>
            </div>
            <div className={s.teamCard}>
              <span className={s.teamIconWrap}>
                <Timer strokeWidth={1.5} />
              </span>
              <h3 className={s.h3}>Clock in at the door</h3>
              <p className={s.bodySm}>
                They clock in from their phone when they walk in. You see
                who’s on the floor, and the hours add up on their own — no
                punch machine, no paper timesheets.
              </p>
            </div>
          </div>
        </section>

        {/* How it works + mid-page CTA */}
        <section className={s.steps} id="how-it-works">
          <h2 className={s.h2}>Set up before the next schedule is due</h2>
          <ol className={s.stepList}>
            <li className={s.step}>
              <span className={s.stepNum}>1</span>
              <h3 className={s.h3}>Add your team</h3>
              <p className={s.bodySm}>
                Type in names and phone numbers. That’s the whole setup —
                everyone gets an invite text with their link.
              </p>
            </li>
            <li className={s.step}>
              <span className={s.stepNum}>2</span>
              <h3 className={s.h3}>Build your first week</h3>
              <p className={s.bodySm}>
                Fill the grid like you’d fill the whiteboard. If two shifts
                collide, or land on a day someone can’t work, the warning
                shows up right on the shift.
              </p>
            </li>
            <li className={s.step}>
              <span className={s.stepNum}>3</span>
              <h3 className={s.h3}>Publish</h3>
              <p className={s.bodySm}>
                Everyone gets a text with a link to their shifts. You’re done
                until next week.
              </p>
            </li>
          </ol>
          <div className={s.midCta}>
            <Link href="/signup" className={s.btnPrimaryLg}>
              Start free
            </Link>
            <p className={s.microcopy}>Free to start. No credit card.</p>
          </div>
        </section>

        {/* Honest pitch */}
        <section className={s.bandSunken}>
          <div className={s.honestCard}>
            <h2 className={s.h2}>We’re new. Here’s the honest pitch.</h2>
            <p className={s.body}>
              RosterHouse is new. You won’t find customer logos or five-star
              quotes on this page because we don’t have them yet — and we
              won’t show you numbers we haven’t earned. What we can tell you:
              starting is free, there’s no credit card and no contract, and if
              something’s confusing, a real person answers your email. Try it
              against your whiteboard for one week. If it doesn’t win, there’s
              nothing to cancel and nothing to uninstall.
            </p>
            <p className={s.bodySm}>
              Built for restaurants, shops, and warehouses — anywhere the
              schedule lives on a wall and changes twice before Friday.
            </p>
          </div>

          {/* FAQ */}
          <div className={s.faq} id="faq">
            <h2 className={s.h2}>Questions managers actually ask</h2>
            {FAQ.map(({ q, a }) => (
              <details key={q} className={s.faqItem}>
                <summary className={s.faqQ}>{q}</summary>
                <p className={s.faqA}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className={s.finalBand}>
          <h2 className={s.finalH2}>Make this Sunday the last messy one</h2>
          <p className={s.finalBody}>
            Add your team, drag out the shifts, hit publish. If it doesn’t
            save you time, you’ve lost 20 minutes.
          </p>
          <Link href="/signup" className={s.btnInverted}>
            Start free
          </Link>
          <p className={s.finalLogin}>
            Already have an account?{" "}
            <Link href="/login" className={s.finalLoginLink}>
              Log in
            </Link>
          </p>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div>
            <span className={s.wordmark}>RosterHouse</span>
            <p className={s.bodySm}>Shift scheduling for hourly teams.</p>
          </div>
          <nav className={s.footerLinks} aria-label="Footer">
            <Link href="/signup">Start free</Link>
            <Link href="/login">Log in</Link>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
        <p className={s.copyright}>© 2026 RosterHouse</p>
      </footer>
    </div>
  );
}
