"""Instagram posts ready to publish from Admin > Marketing.

Each post's images are JPEGs served by the site from frontend/public/social/
(Instagram fetches them from that public URL when publishing). Nothing here
is posted automatically: an admin reviews each post and clicks Publish.
Add new posts to the end of the list; never reuse an id.
"""

HASHTAGS = "#debate #debating #criticalthinking #hottake #agreeordisagree #publicspeaking"

POSTS = [
    # --- Reels: real AI rounds on absurd topics (made with marketing/reels/make_reel.py) ---
    {
        "id": "reel-01-cereal-soup", "title": "Reel: cereal is soup",
        "video": "reel-cereal-soup.mp4", "images": ["reel-cereal-soup-cover.jpg"],
        "caption": "I came in with a dictionary definition. It came back with \"culinary standards\".\n\n"
                   "Is cereal soup? Wrong answers only 👇\n\nThink you can beat 5/10? Link in bio.",
        "hashtags": "#cerealissoup #unhinged #hottake #debate #ai",
    },
    {
        "id": "reel-02-straw-holes", "title": "Reel: a straw has two holes",
        "video": "reel-straw-holes.mp4", "images": ["reel-straw-holes-cover.jpg"],
        "caption": "\"Basic finger maths\" is apparently a fallacy now.\n\n"
                   "One hole or two? Comment your argument and I'll make the AI score it.",
        "hashtags": "#strawhole #unhinged #debate #ai #hottake",
    },
    {
        "id": "reel-03-replying-k", "title": "Reel: replying k is war",
        "video": "reel-replying-k.mp4", "images": ["reel-replying-k-cover.jpg"],
        "caption": "I said nobody has ever received \"k\" and felt loved. It called that a hasty generalisation.\n\n"
                   "What's the most hostile text you've ever received? 👇",
        "hashtags": "#texting #unhinged #debate #ai #relatable",
    },
    # --- Launch posts (static) ---
    {
        "id": "launch-01-intro", "title": "Intro",
        "images": ["01-intro.jpg"],
        "caption": "Most apps show you people who agree with you. We built the opposite.\n\n"
                   "Pick a side, debate an AI that takes the other one, and get scored on clarity, evidence, "
                   "rebuttal and civility. Free, no sign-up. Link in bio.",
    },
    {
        "id": "launch-02-how", "title": "How it works (carousel)",
        "images": ["02-how-1.jpg", "02-how-2.jpg", "02-how-3.jpg", "02-how-4.jpg"],
        "caption": "Six turns. Four scores: clarity, evidence, rebuttal, civility. "
                   "And it tells you which fallacies you used.\n\nTry a round: link in bio.",
    },
    {
        "id": "launch-03-homework", "title": "Motion: homework",
        "images": ["03-homework.jpg"],
        "caption": "Schools should abolish homework. Agree or disagree?\n\n"
                   "Comment your side in one sentence, then try defending it against the AI (link in bio).",
    },
    {
        "id": "launch-04-report", "title": "Real score report",
        "images": ["04-report.jpg"],
        "caption": "I argued for a four-day week and lost on rebuttal. It caught a hasty generalisation.\n\n"
                   "Could you beat 6.75? Link in bio.",
    },
    {
        "id": "launch-05-athletes", "title": "Athletes: for and against (carousel)",
        "images": ["05-athletes-1.jpg", "05-athletes-2.jpg", "05-athletes-3.jpg"],
        "caption": "Top athletes are overpaid. The strongest case on both sides.\n\n"
                   "Which side wins? Full list at the link in bio.",
    },
    {
        "id": "launch-06-social-media", "title": "Motion: social media ban",
        "images": ["06-social-media.jpg"],
        "caption": "Today's motion: under-16s should be banned from social media.\n\n"
                   "Drop your best argument below. Best one gets pinned.",
    },
    {
        "id": "launch-07-quote", "title": "Quote: hasty generalisation",
        "images": ["07-quote.jpg"],
        "caption": "It called my argument a hasty generalisation. It was right.\n\n"
                   "The AI is polite. It is not nice. Try a round: link in bio.",
    },
    {
        "id": "launch-08-remote", "title": "Remote work: for and against (carousel)",
        "images": ["08-remote-1.jpg", "08-remote-2.jpg", "08-remote-3.jpg"],
        "caption": "Remote work or the office? Here's the best case for each.\n\n"
                   "Which side are you on? Debate it at the link in bio.",
    },
    {
        "id": "launch-09-pick-a-fight", "title": "Pick a fight. Politely.",
        "images": ["09-pick-a-fight.jpg"],
        "caption": "Pick a fight. Politely.\n\n"
                   "Free. No sign-up. Six turns against an AI that always takes the other side. Link in bio.",
    },
]

POSTS_BY_ID = {p["id"]: p for p in POSTS}
