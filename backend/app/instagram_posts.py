"""Instagram posts ready to publish from Admin > Marketing.

Each post's images are JPEGs served by the site from frontend/public/social/
(Instagram fetches them from that public URL when publishing). Nothing here
is posted automatically: an admin reviews each post and clicks Publish.
Add new posts to the end of the list; never reuse an id.

Captions are long on purpose: Instagram search reads caption text, so each
one works the topic's search words in naturally. The first line is the hook
(it's all that shows before "more"). Hashtags are capped at five per post.
"""

HASHTAGS = "#debate #debateapp #criticalthinking #hottake #agreeordisagree"


def _c(*paragraphs: str) -> str:
    return "\n\n".join(paragraphs)


POSTS = [
    # --- Reels: real AI rounds on absurd topics (made with marketing/reels/make_reel.py) ---
    {
        "id": "reel-01-cereal-soup", "title": "Reel: cereal is soup",
        "video": "reel-cereal-soup.mp4", "images": ["reel-cereal-soup-cover.jpg"],
        "caption": _c(
            "I came in with a dictionary definition. It came back with \"culinary standards\". 🥣",
            "Is cereal a soup? It's food in a liquid, eaten with a spoon, out of a bowl. That's my whole case, "
            "and I thought it was airtight. The AI disagreed: it argued soup is defined by a liquid that's cooked "
            "together with the ingredients, while milk is just poured on cold. Then it took apart my gazpacho "
            "comeback too.",
            "Final score: 5/10. Clarity 5, evidence 2, rebuttal 4, civility 9. It also flagged my opening line as "
            "a false equivalence, which is the logical fallacy of treating two things as the same because they "
            "share a few surface features.",
            "This is indifferent, a free AI debate app. Pick any topic, pick a side, and an AI argues the "
            "opposite side for six turns. Then it scores your argument on clarity, evidence, rebuttal and "
            "civility, and points out any logical fallacies you used. No sign-up needed to try it.",
            "So settle it: is cereal soup? Wrong answers only 👇 Then try to beat my 5/10 at the link in bio.",
        ),
        "hashtags": "#iscerealsoup #cereal #debate #aidebate #unhinged",
    },
    {
        "id": "reel-02-straw-holes", "title": "Reel: a straw has two holes",
        "video": "reel-straw-holes.mp4", "images": ["reel-straw-holes-cover.jpg"],
        "caption": _c(
            "\"Basic finger maths\" is apparently a logical fallacy now. 🥤",
            "How many holes does a straw have? One or two? I argued two: one finger in each end, two holes, done. "
            "The AI argued one, using topology. In maths a straw is like a doughnut, a single hole that goes all "
            "the way through, and it said I was confusing \"openings\" with \"holes\".",
            "Then I asked it to tell me where the hole starts. It called that an argument from ignorance and "
            "explained that a tunnel doesn't need a starting point. My score: 3/10, with evidence at 2.",
            "This is indifferent, a free debate app where an AI always takes the other side. It's debate "
            "practice for people who like being right, and need to learn how to actually prove it: six turns, "
            "a score for clarity, evidence, rebuttal and civility, and every fallacy named. Try it free with no "
            "sign-up at the link in bio.",
            "One hole or two? Comment your argument and I'll make the AI score it. Best argument gets a video "
            "reply. 👇",
        ),
        "hashtags": "#strawholes #howmanyholes #debate #aidebate #unhinged",
    },
    {
        "id": "reel-03-replying-k", "title": "Reel: replying k is war",
        "video": "reel-replying-k.mp4", "images": ["reel-replying-k-cover.jpg"],
        "caption": _c(
            "I said nobody has ever received \"k\" and felt loved. It called that a hasty generalisation. 📱",
            "Is replying \"k\" rude? Is it passive aggressive? I argued that texting \"k\" is a declaration of "
            "war: \"ok\" is one extra letter, and choosing not to spend it on someone is a choice. The AI took "
            "the other side and argued that \"k\" is just shorthand, that intent matters more than length, and "
            "that plenty of people text \"k\" when they're busy, not angry.",
            "Score: 4.25/10. It named two logical fallacies: hasty generalisation (judging every \"k\" by the "
            "worst one) and false cause (assuming a missing letter means hostility).",
            "This is indifferent, a free AI debate app. Pick a side on any argument, from texting etiquette to "
            "politics, and an AI argues against you for six turns, then scores your critical thinking. No "
            "account needed. Link in bio.",
            "What's the most passive aggressive text you've ever received? 👇",
        ),
        "hashtags": "#textingetiquette #passiveaggressive #debate #aidebate #relatable",
    },
    # --- Launch posts (static) ---
    {
        "id": "launch-01-intro", "title": "Intro",
        "images": ["01-intro.jpg"],
        "caption": _c(
            "Most apps show you people who agree with you. We built the opposite.",
            "indifferent is a free debate app where you argue with someone who actually disagrees with you. "
            "Start by debating an AI: pick a topic, pick your side, and the AI takes the opposite position for "
            "six turns. It argues back properly, calls out weak logic, and never runs out of counterarguments.",
            "When the round ends you get a score report: clarity, evidence, rebuttal and civility out of 10, "
            "what you did well, what to improve, and any logical fallacies you used. It's debate practice, "
            "argument practice and critical thinking practice in about three minutes.",
            "Topics range from serious debate topics like AI and jobs, the four-day week and social media bans, "
            "to completely unhinged ones like whether cereal is soup. When you're ready, you can also debate real "
            "people on live video who were matched to you because they disagree.",
            "Free, no sign-up to try. Link in bio. What topic should we add next? 👇",
        ),
    },
    {
        "id": "launch-02-how", "title": "How it works (carousel)",
        "images": ["02-how-1.jpg", "02-how-2.jpg", "02-how-3.jpg", "02-how-4.jpg"],
        "caption": _c(
            "Six turns. Four scores. Every fallacy named. Swipe to see how it works →",
            "1. Pick a debate topic. Serious ones like remote work, AI and jobs or the voting age, or absurd ones "
            "like whether a hot dog is a sandwich.",
            "2. Pick a side: agree or disagree.",
            "3. The AI argues back. It always takes the opposite side, stays civil, and responds to what you "
            "actually said, so you get real practice at rebuttals instead of easy wins.",
            "4. Get scored. Clarity, evidence, rebuttal and civility out of 10, plus the logical fallacies it "
            "caught, like hasty generalisation, false equivalence or appeal to intuition.",
            "indifferent is a free AI debate app for anyone who wants to argue better: students, debate club "
            "members, people with strong opinions in the group chat. No sign-up needed. Link in bio.",
        ),
    },
    {
        "id": "launch-03-homework", "title": "Motion: homework",
        "images": ["03-homework.jpg"],
        "caption": _c(
            "Schools should abolish homework. Agree or disagree? 📚",
            "Should homework be banned? Supporters say studies find little benefit from homework for younger "
            "children, that it widens the gap between kids with help at home and kids without, and that free "
            "evenings mean more sleep, rest and family time.",
            "Opponents say practice outside class is how lessons stick, especially in maths and languages, that "
            "homework builds independence and time management, and that it shows parents what their child is "
            "learning.",
            "Where do you stand? Comment your side in one sentence, then defend it against an AI that takes the "
            "opposite position. indifferent scores your argument on clarity, evidence, rebuttal and civility. "
            "Free debate practice, no sign-up. Link in bio.",
        ),
        "hashtags": "#homework #education #debate #debatetopics #agreeordisagree",
    },
    {
        "id": "launch-04-report", "title": "Real score report",
        "images": ["04-report.jpg"],
        "caption": _c(
            "I argued for a four-day work week and lost on rebuttal. Could you beat 6.75?",
            "Should every country move to a four-day work week? I argued yes, using the trials where productivity "
            "held steady and burnout fell. The AI argued against: hospitals, schools and shops can't just close a "
            "day, and companies that volunteer for trials aren't typical of a whole economy.",
            "My score report: clarity 8, evidence 6, rebuttal 4, civility 9. Overall 6.75 out of 10. It also "
            "caught a hasty generalisation: I took results from a few trials and applied them to every country.",
            "That's the point of indifferent, a free AI debate app. You find out where your argument is weak "
            "before someone else does. Pick a topic, take a side, debate the AI for six turns and get an honest "
            "score. Link in bio.",
            "Four-day week: yes or no? 👇",
        ),
        "hashtags": "#fourdayweek #worklifebalance #debate #aidebate #criticalthinking",
    },
    {
        "id": "launch-05-athletes", "title": "Athletes: for and against (carousel)",
        "images": ["05-athletes-1.jpg", "05-athletes-2.jpg", "05-athletes-3.jpg"],
        "caption": _c(
            "Are top athletes overpaid? The strongest case on both sides →",
            "For: paying tens of millions for playing a game says society values entertainment over essential "
            "work like nursing and teaching. The money comes from ticket prices, TV subscriptions and merchandise "
            "paid for by ordinary fans. And the headline salaries hide that most professional athletes have "
            "modest, short careers.",
            "Against: athletes are paid out of the revenue they generate, so if they earned less, team owners "
            "would just keep more. Careers are short and injuries are common, so peak earnings have to last a "
            "lifetime. And reaching the top takes rare talent and years of sacrifice.",
            "Which side wins? Pick one and defend it against an AI that argues the other side, then get your "
            "argument scored. indifferent is a free debate app, no sign-up. Link in bio.",
        ),
        "hashtags": "#athletepay #sportsdebate #debate #debatetopics #hottake",
    },
    {
        "id": "launch-06-social-media", "title": "Motion: social media ban",
        "images": ["06-social-media.jpg"],
        "caption": _c(
            "Should under-16s be banned from social media? Best argument gets pinned. 📵",
            "Several countries have passed or proposed a social media age limit. Supporters point to feeds built "
            "to maximise attention, links to worse sleep, anxiety and body image problems in young teens, and "
            "the relief of a clear legal line so no child is the only one left out.",
            "Critics say teens will get around age verification and end up in less moderated corners of the "
            "internet, that social media is where many young people find community, and that age checks for "
            "everyone mean handing ID or face scans to tech companies.",
            "Drop your best argument below 👇 Then test it against an AI that takes the other side and scores "
            "your clarity, evidence, rebuttal and civility. indifferent, the free debate app. Link in bio.",
        ),
        "hashtags": "#socialmediaban #onlinesafety #debate #debatetopics #agreeordisagree",
    },
    {
        "id": "launch-07-quote", "title": "Quote: hasty generalisation",
        "images": ["07-quote.jpg"],
        "caption": _c(
            "It called my argument a hasty generalisation. It was right.",
            "A hasty generalisation is a logical fallacy where you draw a big conclusion from too little "
            "evidence: one bad experience, a couple of examples, a single study. \"I tried it once and it "
            "didn't work\" is the classic. It's probably the most common fallacy in arguments online, and in "
            "every group chat.",
            "The AI on indifferent catches it every time. You pick a debate topic and a side, it argues the "
            "opposite for six turns, then gives you a score report naming any fallacies you used, from hasty "
            "generalisation and false equivalence to argument from ignorance.",
            "It's polite. It is not nice. Free debate practice with no sign-up, link in bio.",
            "Tag the friend who does this in every argument 👇",
        ),
        "hashtags": "#logicalfallacies #criticalthinking #debate #aidebate #arguments",
    },
    {
        "id": "launch-08-remote", "title": "Remote work: for and against (carousel)",
        "images": ["08-remote-1.jpg", "08-remote-2.jpg", "08-remote-3.jpg"],
        "caption": _c(
            "Remote work or the office? The best case for each →",
            "For working from home: no commute gives people back hours every week and cuts travel costs, "
            "employers can hire from anywhere instead of only expensive cities, and many people do focused work "
            "better away from open-plan noise.",
            "For the office: junior staff learn faster by watching and overhearing colleagues, spontaneous "
            "conversations build trust and spark ideas in a way scheduled calls rarely do, and working where you "
            "live blurs work and home and can leave people isolated.",
            "Return to office or work from home forever? Pick your side and debate it against an AI that argues "
            "the other one, then see your score. indifferent is a free debate app, no sign-up. Link in bio.",
        ),
        "hashtags": "#remotework #workfromhome #returntooffice #debate #hottake",
    },
    {
        "id": "launch-09-pick-a-fight", "title": "Pick a fight. Politely.",
        "images": ["09-pick-a-fight.jpg"],
        "caption": _c(
            "Pick a fight. Politely.",
            "indifferent is a free debate app built for arguing with people who disagree with you, starting with "
            "an AI that always takes the other side. Pick any debate topic, from serious questions about AI, "
            "work and politics to unhinged ones like whether water is wet, and argue your case for six turns.",
            "Then you get scored on clarity, evidence, rebuttal and civility, with every logical fallacy named. "
            "It's the fastest way to practise debating, sharpen your critical thinking and find out whether "
            "your opinion actually holds up.",
            "Free. No sign-up. Link in bio. What's the hill you'd die on? 👇",
        ),
    },
]

POSTS_BY_ID = {p["id"]: p for p in POSTS}
