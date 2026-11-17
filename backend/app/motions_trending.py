"""Motions on what people are arguing about online right now (added November 2026):
gaming launches, seasonal shopping, AI in everyday life, TV and money/dating discourse.
They match the topics the @indifferent.app Instagram/YouTube posts push, so someone who
searches "GTA 6 debate" or "is Black Friday a con" lands on a page they can argue on.
Same shape as motions.MOTIONS; appended in motions.py. Summaries stay neutral and avoid
claims about real people."""

TRENDING_MOTIONS = [
    # --- Gaming ---
    {
        "id": "gta6-hype", "slug": "gta-6-cant-live-up-to-the-hype", "tag": "Gaming",
        "motion": "GTA 6 can't live up to the hype",
        "summary": "Grand Theft Auto VI arrives after more than a decade of waiting, record-breaking trailers and repeated delays. Some think no game could match those expectations; others say Rockstar's track record means it will.",
        "for": [
            "More than ten years of anticipation creates expectations no single game can meet.",
            "Trailers show the best moments; the full game will have the usual bugs, filler and grind.",
            "Fans have imagined their own perfect version for years, and the real one will differ from it.",
        ],
        "against": [
            "Rockstar's previous games set the standard for open worlds and sold for over a decade.",
            "The long development time and budget mean far more polish than most releases get.",
            "Most players simply want a huge, detailed world to play in, and that is what the series delivers.",
        ],
    },
    {
        "id": "game-price-70", "slug": "70-pounds-is-a-fair-price-for-a-video-game", "tag": "Gaming",
        "motion": "£70 is a fair price for a new video game",
        "summary": "Big releases have crept up to £70 or more. Publishers point to soaring development costs, while players point to microtransactions and the rising cost of living.",
        "for": [
            "Game prices barely rose for years while budgets grew many times over.",
            "A game that gives you hundreds of hours costs far less per hour than a cinema ticket or a night out.",
            "Nobody is forced to buy at launch; prices drop and sales come quickly.",
        ],
        "against": [
            "Many full-price games still sell battle passes, skins and loot boxes on top.",
            "Higher prices shut out younger and lower-income players.",
            "Digital copies cost almost nothing to distribute, so the savings are not passed on.",
        ],
    },
    {
        "id": "physical-no-disc", "slug": "a-physical-game-without-a-disc-is-a-rip-off", "tag": "Gaming",
        "motion": "A 'physical' game with no disc inside is a rip-off",
        "summary": "Some boxed games now contain only a download code or a key that unlocks a download, rather than the full game on a disc or cartridge. Collectors are unhappy; publishers say it is about file size and cost.",
        "for": [
            "People buy physical copies so they own the game and can play it without downloading.",
            "If the servers or store close, a box with only a key may become worthless.",
            "It is harder to lend, resell or preserve games that need a download.",
        ],
        "against": [
            "Modern games are huge and patched constantly, so most players download anyway.",
            "A boxed key still allows gifting and resale in shops, unlike a digital-only purchase.",
            "It cuts manufacturing costs and waste compared with pressing large discs.",
        ],
    },
    {
        "id": "game-launch-day-off", "slug": "taking-a-day-off-for-a-game-launch-is-reasonable", "tag": "Gaming",
        "motion": "Taking a day off work for a game launch is reasonable",
        "summary": "Big game releases see people booking annual leave or quietly calling in sick. Is it a fair use of holiday, or a sign of misplaced priorities?",
        "for": [
            "Annual leave is yours to use on whatever you enjoy, the same as a concert or a football match.",
            "Launch week is a shared moment with friends and online communities.",
            "Taking a planned day off is better than turning up tired and distracted.",
        ],
        "against": [
            "The game will still be there at the weekend.",
            "Calling in sick for a game is dishonest and leaves colleagues covering for you.",
            "Building a week around a video game says something about priorities.",
        ],
    },
    {
        "id": "game-leaks", "slug": "sharing-leaked-game-footage-is-wrong", "tag": "Gaming",
        "motion": "Sharing leaked game footage is wrong",
        "summary": "Major games regularly leak months before launch, sometimes through hacks. Some fans love the early look; developers say it ruins years of work and surprises.",
        "for": [
            "Leaks show unfinished work, which can damage a game's reputation unfairly.",
            "Hacked material involves real crimes against real employees.",
            "Spoiling story moments takes the surprise away from everyone else.",
        ],
        "against": [
            "Once something is public, sharing it does no extra harm.",
            "Leaks often give fans honest information that marketing would hide.",
            "Fans hungry for news after years of silence are not the villains.",
        ],
    },
    {
        "id": "goty-wait", "slug": "game-of-the-year-awards-should-wait-a-year", "tag": "Gaming",
        "motion": "Game of the Year awards should wait until games have been out a while",
        "summary": "Games released late in the year can win awards after only a few weeks on sale, while earlier games have been fully tested by players. Should awards wait?",
        "for": [
            "A few weeks is not long enough to judge a game's endgame, balance and bugs.",
            "Late releases get a hype boost that earlier games have already lost.",
            "Waiting would reward games that hold up, not just strong first impressions.",
        ],
        "against": [
            "Film and music awards also judge recent releases quickly.",
            "Delaying awards by a year would make them feel out of date.",
            "Critics play games thoroughly before reviewing, so they can judge them fairly.",
        ],
    },
    {
        "id": "gaming-eight-hours", "slug": "gaming-for-eight-hours-straight-is-a-problem", "tag": "Gaming",
        "motion": "Gaming for eight hours straight is a problem",
        "summary": "Long gaming sessions are common, especially around big launches. Is an all-day session harmless fun or a warning sign?",
        "for": [
            "Sitting for eight hours is bad for posture, sleep and eyesight.",
            "Regularly losing whole days to games can crowd out work, exercise and relationships.",
            "Games are designed to keep you playing, which makes it easy to lose control.",
        ],
        "against": [
            "People binge box sets or read all day without anyone calling it a problem.",
            "Gaming is often social, with friends online for the whole session.",
            "An occasional long session is a hobby; only a pattern that harms your life is a problem.",
        ],
    },
    {
        "id": "game-unions", "slug": "game-developers-should-unionise", "tag": "Gaming",
        "motion": "Game developers should unionise",
        "summary": "Crunch, mass layoffs and short contracts are common in the games industry. Unions are growing at some studios, while others worry about the effect on creative work.",
        "for": [
            "Long periods of crunch and sudden layoffs are widespread in the industry.",
            "Collective bargaining gives workers a say in pay, hours and job security.",
            "Unions exist in film and TV without stopping great work being made.",
        ],
        "against": [
            "Games are unpredictable, and studios need flexibility to survive.",
            "Rigid rules could slow development and raise prices.",
            "Many developers prefer to negotiate individually or move studios.",
        ],
    },
    {
        "id": "online-age-checks", "slug": "websites-should-verify-users-ages", "tag": "Technology",
        "motion": "Websites and games should have to check users' ages",
        "summary": "Laws in several countries now require age checks for some online content and platforms. Supporters say it protects children; critics warn about privacy and easy workarounds.",
        "for": [
            "Children can easily see harmful content when a single click asks if they are 18.",
            "We already check ages for alcohol, gambling and films in cinemas.",
            "Age checks put responsibility on platforms rather than only on parents.",
        ],
        "against": [
            "Uploading ID or face scans creates privacy and data-breach risks.",
            "Determined teenagers can use VPNs or borrowed details to get round checks.",
            "Adults should not have to prove their identity to use ordinary websites.",
        ],
    },
    # --- TV & entertainment ---
    {
        "id": "bushtucker-animals", "slug": "bushtucker-trials-should-stop-using-live-animals", "tag": "Movies & TV",
        "motion": "Bushtucker trials should stop using live animals",
        "summary": "Jungle reality shows have long featured trials with live insects and creatures. Animal welfare groups object; fans say it is harmless and part of the fun.",
        "for": [
            "Thousands of animals are used for a few seconds of entertainment.",
            "Eating live creatures for TV sends the wrong message about animal welfare.",
            "The shows could easily build trials around skill or fear without live animals.",
        ],
        "against": [
            "Most creatures used are insects that are bred and eaten as food around the world.",
            "The trials are what viewers tune in for.",
            "Broadcasters already follow welfare guidelines and expert advice.",
        ],
    },
    {
        "id": "scam-dramas", "slug": "dramas-about-real-scammers-glamourise-them", "tag": "Movies & TV",
        "motion": "TV dramas about real scammers glamourise them",
        "summary": "Streaming services love stories about real fraudsters and fallen tech founders. Are they warnings or celebrations?",
        "for": [
            "Casting charming stars makes con artists likeable.",
            "Victims rarely get as much screen time as the scammer.",
            "Fame and attention can be exactly what scammers wanted.",
        ],
        "against": [
            "Showing how scams work helps viewers avoid falling for them.",
            "Drama about bad people has always been part of storytelling.",
            "Most shows end with the consequences, not the glamour.",
        ],
    },
    {
        "id": "spoilers-week", "slug": "spoilers-are-fair-game-after-a-week", "tag": "Movies & TV",
        "motion": "Spoilers are fair game after a week",
        "summary": "With streaming drops, game launches and worldwide releases, everyone experiences stories at different times. How long should people stay quiet?",
        "for": [
            "People want to talk about what they have watched or played while it is fresh.",
            "A week is plenty of time for anyone who really cares.",
            "It is up to you to mute words and avoid comment sections.",
        ],
        "against": [
            "Not everyone can binge a series or finish a 60-hour game in a week.",
            "A thoughtless spoiler can ruin something people waited years for.",
            "Clear warnings cost nothing, so there is no reason not to use them.",
        ],
    },
    {
        "id": "christmas-adverts", "slug": "christmas-adverts-have-become-too-emotional", "tag": "Movies & TV",
        "motion": "Christmas adverts have become too emotional",
        "summary": "Big retailers now launch Christmas adverts like film premieres, often designed to make viewers cry. Are they a festive tradition or emotional manipulation?",
        "for": [
            "Tear-jerking stories are used to sell products.",
            "They set expectations for a perfect Christmas many people can't afford.",
            "The arms race to be the most emotional has made them predictable.",
        ],
        "against": [
            "Many people look forward to them as the start of the festive season.",
            "Good adverts are short films with real craft behind them.",
            "Nobody is forced to buy anything because an advert made them feel something.",
        ],
    },
    # --- Shopping & seasonal ---
    {
        "id": "black-friday-con", "slug": "black-friday-deals-are-a-con", "tag": "Money & Work",
        "motion": "Black Friday deals are a con",
        "summary": "Black Friday promises huge discounts, but consumer groups regularly find many 'deals' were cheaper at other times of year. Are there real bargains, or just clever marketing?",
        "for": [
            "Consumer groups have found many Black Friday prices were matched or beaten earlier in the year.",
            "Countdown timers and 'limited stock' messages are designed to rush decisions.",
            "It encourages people to buy things they did not plan to buy at all.",
        ],
        "against": [
            "Genuine discounts exist if you track prices and know what you want.",
            "It lets people buy planned Christmas presents for less.",
            "Shoppers can compare prices online more easily than ever.",
        ],
    },
    {
        "id": "christmas-tree-november", "slug": "christmas-decorations-should-wait-until-december", "tag": "Society",
        "motion": "Christmas decorations should wait until December",
        "summary": "Every year the argument returns: is putting up the tree in November festive cheer or far too early?",
        "for": [
            "Starting too early makes Christmas feel stretched and less special.",
            "A real tree will drop its needles long before 25 December.",
            "November deserves to be its own month, not just Christmas build-up.",
        ],
        "against": [
            "Dark winter evenings are brighter with lights up early.",
            "If decorations make you happy, there is no reason to wait.",
            "Shops start in October anyway, so it already feels like Christmas.",
        ],
    },
    {
        "id": "secret-santa", "slug": "secret-santa-at-work-should-be-scrapped", "tag": "Money & Work",
        "motion": "Secret Santa at work should be scrapped",
        "summary": "Office Secret Santa is meant to build team spirit, but plenty of people dread buying for colleagues they barely know.",
        "for": [
            "It pressures people to spend money they may not have.",
            "Buying for someone you barely know leads to pointless gifts and waste.",
            "Joke gifts can be awkward or even offensive.",
        ],
        "against": [
            "A small price limit makes it cheap and fun.",
            "It gets colleagues talking and helps new staff feel included.",
            "Taking part is usually optional anyway.",
        ],
    },
    {
        "id": "luxury-advent", "slug": "luxury-advent-calendars-are-a-waste-of-money", "tag": "Money & Work",
        "motion": "Luxury advent calendars are a waste of money",
        "summary": "Advent calendars now come filled with beauty products, jewellery and gadgets, sometimes costing well over £100. Treat or waste?",
        "for": [
            "Many are filled with sample sizes worth less than the box price suggests.",
            "They encourage buying lots of small things you would never choose.",
            "The packaging alone creates huge amounts of waste.",
        ],
        "against": [
            "Brands often say the contents are worth more than the price.",
            "They are a fun way to try products you might not buy on their own.",
            "If someone enjoys opening one each day, it is money well spent.",
        ],
    },
    {
        "id": "christmas-alternate", "slug": "couples-should-alternate-christmas-between-families", "tag": "Relationships",
        "motion": "Couples should alternate Christmas between families",
        "summary": "Whose family gets Christmas is one of the most common arguments for couples. Is alternating years the fair answer?",
        "for": [
            "It is simple and treats both families equally.",
            "Each family knows when its turn is coming.",
            "It avoids the same argument every December.",
        ],
        "against": [
            "Circumstances differ, such as an elderly relative or a much bigger family.",
            "Some couples would rather start their own traditions at home.",
            "Rigid rules ignore what each family actually wants.",
        ],
    },
    # --- AI and tech in everyday life ---
    {
        "id": "ai-pause", "slug": "ai-development-should-be-paused", "tag": "Technology",
        "motion": "AI development should be paused",
        "summary": "Some researchers and public figures have called for a pause on the most powerful AI systems until safety catches up. Others say a pause is unrealistic and would hand the lead to others.",
        "for": [
            "AI capabilities are advancing faster than our understanding of the risks.",
            "Laws and safety checks need time to catch up.",
            "Once powerful systems are released, their effects can't easily be undone.",
        ],
        "against": [
            "A pause would be impossible to enforce worldwide.",
            "AI is already helping in medicine, science and accessibility.",
            "Careful regulation is better than stopping progress altogether.",
        ],
    },
    {
        "id": "ai-texts-partner", "slug": "using-ai-to-text-your-partner-is-fine", "tag": "Relationships",
        "motion": "Using AI to write messages to your partner is fine",
        "summary": "People increasingly use chatbots to draft texts, apologies and even love notes. Is it a helpful tool or a betrayal of something personal?",
        "for": [
            "It helps people who struggle to find the right words say what they really feel.",
            "Nobody objects to using a card with a printed message.",
            "What matters is the intention behind the message, not who typed it.",
        ],
        "against": [
            "Partners expect your words, not a machine's.",
            "Relying on AI can stop you learning to communicate yourself.",
            "Finding out would make many people feel deceived.",
        ],
    },
    {
        "id": "voice-clone-consent", "slug": "cloning-someones-voice-should-need-consent", "tag": "Technology",
        "motion": "Cloning someone's voice with AI should require their consent by law",
        "summary": "AI can now copy a voice from a few seconds of audio. It powers fun apps and accessibility tools, but also phone scams and fake celebrity clips.",
        "for": [
            "Scammers use cloned voices to trick families into sending money.",
            "Your voice is part of your identity and should not be used without permission.",
            "Clear consent rules would protect performers whose voices are their living.",
        ],
        "against": [
            "Parody and satire have always imitated famous voices.",
            "Scammers already break the law, so a new rule may not stop them.",
            "Overly strict rules could block useful tools, such as voices for people who have lost theirs.",
        ],
    },
    {
        "id": "ai-companions", "slug": "ai-companions-make-loneliness-worse", "tag": "Technology",
        "motion": "AI companions make loneliness worse",
        "summary": "Millions of people chat daily with AI friends and partners. Supporters say they help lonely people; critics fear they replace real human connection.",
        "for": [
            "An AI that always agrees can make real relationships feel harder by comparison.",
            "Time spent with a chatbot is time not spent building real friendships.",
            "Companies profit from keeping lonely users hooked.",
        ],
        "against": [
            "For isolated people, someone to talk to is better than no one.",
            "Practising conversation can build confidence for real social situations.",
            "Adults should be free to find comfort where they choose.",
        ],
    },
    {
        "id": "smartphones-14", "slug": "children-shouldnt-have-smartphones-before-14", "tag": "Society",
        "motion": "Children shouldn't have smartphones before 14",
        "summary": "Parent groups are pledging to delay smartphones until secondary school or later. Others say a ban leaves children isolated from friends.",
        "for": [
            "Early smartphone use is linked by many researchers to worse sleep and attention.",
            "Basic phones allow calls and texts without social media and endless scrolling.",
            "If parents delay together, no child is left out.",
        ],
        "against": [
            "Group chats are where friendships happen, so children without phones miss out.",
            "Learning to use phones sensibly with parental help is better than a sudden free-for-all at 14.",
            "Smartphones help with travel, safety and schoolwork.",
        ],
    },
    {
        "id": "after-hours-email", "slug": "work-emails-after-hours-should-be-banned", "tag": "Money & Work",
        "motion": "Work emails after hours should be banned",
        "summary": "Some countries give workers a legal 'right to disconnect' from messages outside working hours. Should it be the norm everywhere?",
        "for": [
            "Being always reachable leads to stress and burnout.",
            "Clear boundaries make people more productive during working hours.",
            "Staff should not be quietly expected to work unpaid evenings.",
        ],
        "against": [
            "Global teams work across time zones.",
            "Some jobs genuinely involve emergencies.",
            "Many people prefer flexible hours over a strict cut-off.",
        ],
    },
    {
        "id": "dumbphones", "slug": "dumbphones-are-better-than-smartphones", "tag": "Technology",
        "motion": "Dumbphones are better than smartphones",
        "summary": "Basic phones, flip phones and even typewriters are having a moment as people try to cut screen time. Real fix or trend?",
        "for": [
            "Without apps, you spend far less time scrolling.",
            "A week of battery and a lower price are real advantages.",
            "It makes you more present with the people around you.",
        ],
        "against": [
            "Maps, banking, tickets and two-factor logins now need a smartphone.",
            "Screen-time settings can limit apps without giving up useful tools.",
            "It often becomes a second gadget rather than a real change.",
        ],
    },
    # --- Money & dating ---
    {
        "id": "whoever-asks-pays", "slug": "whoever-asks-should-pay-on-a-first-date", "tag": "Relationships",
        "motion": "Whoever asks should pay on a first date",
        "summary": "Splitting the bill, taking turns, or the person who suggested the date pays: first-date money etiquette is endlessly argued online.",
        "for": [
            "Inviting someone out means hosting them, just like inviting a friend for dinner.",
            "It removes the awkward moment when the bill arrives.",
            "The person asking chose the place and the price.",
        ],
        "against": [
            "Splitting the bill keeps things equal from the start.",
            "It can create pressure or a sense of owing something.",
            "The person who asked may earn much less.",
        ],
    },
    {
        "id": "money-first-date", "slug": "talking-about-money-on-a-first-date-is-fine", "tag": "Relationships",
        "motion": "Talking about money on a first date is fine",
        "summary": "Money is one of the biggest causes of relationship stress, yet many people still treat it as off-limits early on.",
        "for": [
            "Money habits are a major source of conflict, so it is smart to know early.",
            "Being open about it shows honesty and maturity.",
            "It saves time if your goals are completely different.",
        ],
        "against": [
            "It can make a date feel like a job interview.",
            "There is plenty of time to discuss it once you know each other.",
            "Asking about income too soon can seem judgemental.",
        ],
    },
    {
        "id": "birthday-off", "slug": "everyone-should-get-their-birthday-off-work", "tag": "Unhinged",
        "motion": "Everyone should get their birthday off work",
        "summary": "Some companies already give staff a paid day off on their birthday. Should it be a right for everyone?",
        "for": [
            "It is one day a year and costs employers very little.",
            "It shows staff they are valued as people.",
            "Nobody does their best work on their birthday anyway.",
        ],
        "against": [
            "Staff can already book their birthday off as annual leave.",
            "It would be hard for small businesses and shift-based jobs.",
            "Not everyone enjoys their birthday or wants a fuss.",
        ],
    },
    {
        "id": "hundred-men-gorilla", "slug": "100-men-would-beat-a-gorilla", "tag": "Unhinged",
        "motion": "100 unarmed men would beat a gorilla",
        "summary": "The internet's favourite hypothetical: 100 average, unarmed men against one adult silverback gorilla. Who wins?",
        "for": [
            "With 100 people, the gorilla would eventually be overwhelmed by sheer numbers.",
            "A gorilla would tire after fighting dozens of people.",
            "Coordinated groups could pin its limbs down.",
        ],
        "against": [
            "A silverback is many times stronger than a human and could injure people with every hit.",
            "Most people would panic and run after seeing the first few hurt.",
            "Untrained people would not coordinate well in real chaos.",
        ],
    },
]
