"""Evergreen motions people search for all year (added 18 November 2026).

Chosen to match what performs on the @indifferent.app Instagram page (gaming, money and work,
relationships, family, everyday "unhinged" arguments), and phrased like the questions people
actually type into Google, so a search lands on a page they can argue on.
Same shape as motions.MOTIONS; appended in motions.py. Neutral summaries, no claims about real
people, no politics or religion.
"""

EVERGREEN_MOTIONS = [
    # --- Gaming ---
    {
        "id": "loot-boxes-gambling", "slug": "loot-boxes-are-gambling", "tag": "Gaming",
        "motion": "Loot boxes are gambling",
        "summary": "Paid loot boxes give players a random reward for real money. Some countries treat them like gambling; publishers say they are just surprise mechanics.",
        "for": [
            "You pay real money for a random chance at something valuable, which is how gambling works.",
            "The flashing animations and near-misses use the same tricks as slot machines.",
            "Children can buy them easily, often without understanding the odds.",
        ],
        "against": [
            "You always get something, so you can't lose everything like a bet.",
            "Most items have no official cash value and can't be cashed out.",
            "Buying them is optional; the game itself can be played without spending.",
        ],
    },
    {
        "id": "cheat-single-player", "slug": "cheating-in-single-player-games-is-fine", "tag": "Gaming",
        "motion": "Cheating in single-player games is fine",
        "summary": "Cheat codes, trainers and mods have been part of gaming for decades. Some players think it ruins the experience; others say it's nobody else's business.",
        "for": [
            "Nobody else is affected, so there's no one being cheated.",
            "You paid for the game and can enjoy it however you like.",
            "Cheats let people with less time or ability see the whole story.",
        ],
        "against": [
            "Beating a challenge yourself is the point and the reward.",
            "Skipping the struggle makes the game feel hollow and forgettable.",
            "Habits from single-player can slide into multiplayer, where cheating does hurt others.",
        ],
    },
    {
        "id": "remasters-cash-grab", "slug": "game-remasters-are-lazy-cash-grabs", "tag": "Gaming",
        "motion": "Game remasters are lazy cash grabs",
        "summary": "Studios keep re-releasing older hits with sharper graphics. Fans are split between welcoming a classic back and wishing the money went into new games.",
        "for": [
            "Selling the same game again costs far less than making something new.",
            "Some remasters launch with new bugs while charging close to full price.",
            "Studios lean on nostalgia instead of taking creative risks.",
        ],
        "against": [
            "They keep classics playable on modern hardware for new players.",
            "Good remasters fix controls and performance that aged badly.",
            "Their sales help fund the riskier original projects.",
        ],
    },
    {
        "id": "mobile-real-gaming", "slug": "mobile-gaming-is-real-gaming", "tag": "Gaming",
        "motion": "Mobile gaming is real gaming",
        "summary": "Phones are now the most common way people play games, yet many console and PC players don't count it. Is a gamer defined by the device or the playing?",
        "for": [
            "More people play games on phones than on any other device.",
            "Many mobile games are competitive, skilful and deep.",
            "Gatekeeping by device makes gaming less welcoming.",
        ],
        "against": [
            "Many mobile games are built around timers and spending, not play.",
            "Short sessions on a train aren't the same commitment as a hobby.",
            "Touch controls limit the kind of games that are possible.",
        ],
    },
    {
        "id": "easy-mode", "slug": "every-game-should-have-an-easy-mode", "tag": "Gaming",
        "motion": "Every game should have an easy mode",
        "summary": "Some studios build games around brutal difficulty. Others add easy modes and accessibility options. Should difficulty be a choice for every player?",
        "for": [
            "Players with disabilities or little free time deserve to finish games they paid for.",
            "An optional setting doesn't change the game for anyone who doesn't use it.",
            "More players finishing a game means more people talking about it.",
        ],
        "against": [
            "Some games are designed around difficulty, and the struggle is the art.",
            "Shared challenge creates the sense of achievement fans bond over.",
            "Designers should be free to make the game they want to make.",
        ],
    },
    {
        "id": "early-access", "slug": "early-access-games-are-a-scam", "tag": "Gaming",
        "motion": "Early access games are a scam",
        "summary": "Early access lets players buy unfinished games and help shape them. Some become hits; others are abandoned half-built.",
        "for": [
            "You pay full or near-full price for something that may never be finished.",
            "Some developers stop updating once the sales slow down.",
            "Players end up doing free testing work for the studio.",
        ],
        "against": [
            "It funds small studios that couldn't otherwise finish their game.",
            "Player feedback has made several early access games far better.",
            "The deal is clear upfront, and you can wait for the full release.",
        ],
    },
    {
        "id": "battle-pass", "slug": "battle-passes-are-worse-than-paying-once", "tag": "Gaming",
        "motion": "Battle passes are worse than paying for a game once",
        "summary": "Many games now sell seasonal battle passes instead of, or as well as, a one-off price. Is it fair value or a treadmill?",
        "for": [
            "Passes push you to play daily so you don't waste what you paid for.",
            "Over a year, seasons can cost more than a full game.",
            "They turn a hobby into a list of chores.",
        ],
        "against": [
            "They let free games stay free for most players.",
            "They're cheaper upfront than a full-price game.",
            "Regular seasons keep games updated with new content for years.",
        ],
    },
    {
        "id": "kids-online-strangers", "slug": "kids-shouldnt-play-online-games-with-strangers", "tag": "Gaming",
        "motion": "Kids shouldn't play online games with strangers",
        "summary": "Online play is how many children socialise now, but it also puts them in chats with adults they don't know. Where should parents draw the line?",
        "for": [
            "Open voice and text chat exposes children to people they can't vet.",
            "Toxic behaviour in lobbies is common and hard to filter.",
            "Playing with real-life friends gives the fun without the risk.",
        ],
        "against": [
            "Online games are where many kids' friendships actually happen.",
            "Parental controls can limit chat without banning play.",
            "Teaching kids to handle strangers safely is better than shielding them.",
        ],
    },

    # --- Money & Work ---
    {
        "id": "renting-vs-buying", "slug": "renting-is-better-than-buying-a-home", "tag": "Money & Work",
        "motion": "Renting is better than buying a home",
        "summary": "Owning a home has long been seen as the goal, but high prices and interest rates have more people asking whether renting is the smarter choice.",
        "for": [
            "Renting leaves you free to move for jobs or life changes.",
            "Repairs, upkeep and big surprise bills are the landlord's problem.",
            "Money that would go on a deposit can be saved or invested elsewhere.",
        ],
        "against": [
            "Mortgage payments build something you own; rent is gone each month.",
            "Owners can't be asked to leave or hit with sudden rent rises.",
            "You can decorate, renovate and keep pets without asking permission.",
        ],
    },
    {
        "id": "hustle-culture", "slug": "hustle-culture-is-toxic", "tag": "Money & Work",
        "motion": "Hustle culture is toxic",
        "summary": "Rise at 5am, grind all weekend, never stop. Hustle culture promises success through constant work. Critics say it sells burnout as ambition.",
        "for": [
            "Working nonstop is linked to burnout, poor sleep and worse health.",
            "It treats rest and family time as weakness.",
            "Success often depends on luck and connections, not just hours put in.",
        ],
        "against": [
            "Hard work early in a career can open doors for life.",
            "Some people genuinely love their work and choose to do more of it.",
            "Telling people not to push themselves can hold back those starting with less.",
        ],
    },
    {
        "id": "never-lend-friends", "slug": "you-should-never-lend-money-to-friends", "tag": "Money & Work",
        "motion": "You should never lend money to friends",
        "summary": "Lending to a friend can feel like the right thing to do, until repayment gets awkward. Is it a kindness or a friendship-ender?",
        "for": [
            "Unpaid loans create resentment that can end friendships.",
            "Asking for your money back feels like nagging someone you care about.",
            "If you can afford it, giving it as a gift avoids all of that.",
        ],
        "against": [
            "Helping a friend through a tough moment is what friends are for.",
            "Clear terms and honest conversations make loans work fine.",
            "Refusing can hurt a friendship just as much as a bad loan.",
        ],
    },
    {
        "id": "bnpl-ban", "slug": "buy-now-pay-later-should-be-banned", "tag": "Money & Work",
        "motion": "Buy now, pay later should be banned",
        "summary": "Splitting a purchase into interest-free instalments has become a checkout button on almost every shop. Handy budgeting tool or debt in disguise?",
        "for": [
            "It makes spending money you don't have feel painless.",
            "Several small plans can quietly add up to serious debt.",
            "Late fees and missed payments can hurt your credit.",
        ],
        "against": [
            "Used properly it's interest-free, which is cheaper than a credit card.",
            "It helps people spread the cost of essentials.",
            "Better rules and clearer warnings would fix the problems without a ban.",
        ],
    },
    {
        "id": "joint-account", "slug": "couples-should-have-a-joint-bank-account", "tag": "Money & Work",
        "motion": "Couples should have a joint bank account",
        "summary": "Some couples pool everything, some keep it all separate, and many do a bit of both. Does sharing money build trust or cause fights?",
        "for": [
            "Pooling money makes you a team working toward the same goals.",
            "Shared bills and savings are simpler to manage in one place.",
            "Hiding finances from a partner is a warning sign.",
        ],
        "against": [
            "Separate money gives each person independence and privacy.",
            "Different spending habits cause fewer arguments when kept apart.",
            "It's safer if the relationship ends or one partner is controlling.",
        ],
    },
    {
        "id": "pay-kids-chores", "slug": "kids-should-be-paid-for-doing-chores", "tag": "Money & Work",
        "motion": "Kids should be paid for doing chores",
        "summary": "Pocket money for tidying up teaches the value of work, some parents say. Others think helping at home shouldn't come with a price tag.",
        "for": [
            "It links money to effort, which is how the real world works.",
            "Kids learn to save and budget with money they earned.",
            "It motivates them to do jobs they'd otherwise avoid.",
        ],
        "against": [
            "Helping the household is part of being in a family, not a job.",
            "Kids may refuse to help unless they're paid.",
            "Pocket money can teach budgeting without being tied to chores.",
        ],
    },
    {
        "id": "self-checkouts", "slug": "self-checkouts-are-worse-than-staffed-tills", "tag": "Money & Work",
        "motion": "Self-checkouts are worse than staffed tills",
        "summary": "Self-service machines now fill supermarkets. Shoppers either love the speed or hate the 'unexpected item in the bagging area'.",
        "for": [
            "They break constantly and need staff to fix them anyway.",
            "Customers end up doing the shop's work for free.",
            "They remove jobs and the human contact some people rely on.",
        ],
        "against": [
            "They're quicker for small shops and cut queues.",
            "Plenty of people prefer not to make small talk.",
            "Staff can be moved to helping customers instead of scanning.",
        ],
    },
    {
        "id": "quiet-quitting", "slug": "quiet-quitting-is-justified", "tag": "Money & Work",
        "motion": "Quiet quitting is justified",
        "summary": "Quiet quitting means doing exactly what your job requires and nothing more. Is it healthy boundary-setting or just giving up?",
        "for": [
            "Your contract sets your duties; extra unpaid work is a favour, not an obligation.",
            "Going above and beyond is rarely rewarded with pay.",
            "Protecting your time helps prevent burnout.",
        ],
        "against": [
            "Doing the minimum can stall your career and reputation.",
            "Colleagues often end up picking up the slack.",
            "If a job is that bad, it's more honest to look for another one.",
        ],
    },
    {
        "id": "open-plan-offices", "slug": "open-plan-offices-should-be-scrapped", "tag": "Money & Work",
        "motion": "Open-plan offices should be scrapped",
        "summary": "Open-plan offices were sold as a way to boost teamwork. Many workers say they mostly boost noise and distraction.",
        "for": [
            "Constant noise and interruptions make focused work hard.",
            "People often wear headphones and message each other instead of talking.",
            "Germs spread faster when everyone shares one big room.",
        ],
        "against": [
            "They make it easy to ask quick questions and learn from others.",
            "They're cheaper, which can keep a business going.",
            "Quiet rooms and booths can fix the noise problem without walls.",
        ],
    },
    {
        "id": "degree-not-needed", "slug": "you-dont-need-a-degree-to-succeed", "tag": "Money & Work",
        "motion": "You don't need a degree to succeed",
        "summary": "More employers are dropping degree requirements, and apprenticeships are growing. Is university still the safest route to a good career?",
        "for": [
            "Many well-paid careers value skills and experience over qualifications.",
            "Apprenticeships let you earn while you learn, without debt.",
            "Some of the most successful people never finished university.",
        ],
        "against": [
            "Graduates still tend to earn more over a lifetime.",
            "Many professions, like medicine and law, require a degree.",
            "University builds networks and skills that are hard to get elsewhere.",
        ],
    },

    # --- Relationships ---
    {
        "id": "friends-with-ex", "slug": "you-can-stay-friends-with-your-ex", "tag": "Relationships",
        "motion": "You can stay friends with your ex",
        "summary": "Some people stay close after a break-up; others cut contact completely. Can a romance really turn into a friendship?",
        "for": [
            "If you were good together, it's a shame to lose someone who knows you that well.",
            "Shared friends and families make clean breaks hard anyway.",
            "Mature adults can move on from romance without hostility.",
        ],
        "against": [
            "Staying close makes it harder to heal and move on.",
            "It can make new partners uncomfortable.",
            "Old feelings tend to resurface at the worst moments.",
        ],
    },
    {
        "id": "tell-friend-cheating", "slug": "you-should-tell-a-friend-their-partner-is-cheating", "tag": "Relationships",
        "motion": "You should tell a friend their partner is cheating",
        "summary": "You know something your friend doesn't. Telling them could save them, or cost you the friendship.",
        "for": [
            "A real friend wouldn't let someone be lied to.",
            "They'll likely find out eventually, and feel betrayed you kept quiet.",
            "Everyone deserves the information to make their own choices.",
        ],
        "against": [
            "If you're not certain, you could wreck a relationship over a mistake.",
            "People often blame the messenger.",
            "It's their relationship, and it may be more complicated than it looks.",
        ],
    },
    {
        "id": "long-distance", "slug": "long-distance-relationships-never-work", "tag": "Relationships",
        "motion": "Long-distance relationships never work",
        "summary": "Video calls and cheap travel make long distance easier than ever, but many couples still find it too hard. Is it doomed from the start?",
        "for": [
            "Physical time together is hard to replace with screens.",
            "Different time zones and routines make couples drift apart.",
            "Travel costs and missed moments build resentment.",
        ],
        "against": [
            "Plenty of couples survive distance and end up living together.",
            "Distance forces better communication.",
            "It's a temporary stage for many, not a permanent state.",
        ],
    },
    {
        "id": "move-in-six-months", "slug": "moving-in-together-after-six-months-is-too-soon", "tag": "Relationships",
        "motion": "Moving in together after six months is too soon",
        "summary": "High rents push many couples to move in quickly. Is six months enough to know someone, or a recipe for regret?",
        "for": [
            "The honeymoon phase is still running, so you don't know each other's habits yet.",
            "Breaking up is far harder when you share a lease.",
            "Money can push couples into a decision their feelings aren't ready for.",
        ],
        "against": [
            "When you know, you know, and plenty of quick moves work out.",
            "Living together is the fastest way to find out if you're compatible.",
            "Splitting rent makes life far more affordable.",
        ],
    },
    {
        "id": "opposite-sex-best-friend", "slug": "its-fine-to-have-a-best-friend-of-the-opposite-sex", "tag": "Relationships",
        "motion": "It's fine to have a best friend of the opposite sex when you're in a relationship",
        "summary": "Close friendships across genders are common, but they can cause tension when one friend has a partner. Harmless or a red flag?",
        "for": [
            "Friendship doesn't have to be romantic, whatever the genders.",
            "Asking a partner to drop a long-term friend is controlling.",
            "Trust in a relationship should cover friendships too.",
        ],
        "against": [
            "Very close friendships can create emotional intimacy a partner lacks.",
            "It's reasonable for a partner to feel uneasy about it.",
            "Boundaries should be agreed together, not assumed.",
        ],
    },
    {
        "id": "big-weddings", "slug": "big-weddings-are-a-waste-of-money", "tag": "Relationships",
        "motion": "Big weddings are a waste of money",
        "summary": "Weddings can easily cost as much as a house deposit. Is a huge celebration worth it, or should couples spend the money on their future?",
        "for": [
            "Spending thousands on one day can delay buying a home or starting a family.",
            "Many couples go into debt to pay for it.",
            "Guests often remember the party less than the couple expects.",
        ],
        "against": [
            "It's a once-in-a-lifetime celebration with the people you love.",
            "It's the couple's money and their choice how to spend it.",
            "Bringing families together has value that isn't measured in money.",
        ],
    },
    {
        "id": "public-proposals", "slug": "public-proposals-are-a-red-flag", "tag": "Relationships",
        "motion": "Public proposals are a red flag",
        "summary": "Jumbotron proposals and flash-mob engagements go viral, but some people find them pressuring. Romantic gesture or trap?",
        "for": [
            "Saying no in front of a crowd is extremely hard, so it pressures a yes.",
            "It can be more about the show than the partner.",
            "A private moment should be decided by two people, not an audience.",
        ],
        "against": [
            "Some people love a big public gesture.",
            "Couples usually discuss marriage beforehand, so it's rarely a surprise.",
            "Sharing joy with others is part of the fun.",
        ],
    },
    {
        "id": "housework-50-50", "slug": "housework-should-always-be-split-50-50", "tag": "Relationships",
        "motion": "Housework should always be split 50/50",
        "summary": "Who does the dishes is one of the most common things couples argue about. Is an even split the only fair way?",
        "for": [
            "An even split is the clearest definition of fair.",
            "Uneven housework is a common source of resentment.",
            "Both people live in the home, so both should look after it.",
        ],
        "against": [
            "Fair isn't always equal if one partner works longer hours.",
            "Couples can split jobs by preference instead of strict halves.",
            "Keeping score can cause more arguments than it solves.",
        ],
    },

    # --- Family & Education ---
    {
        "id": "homeschooling", "slug": "homeschooling-is-better-than-school", "tag": "Education",
        "motion": "Homeschooling is better than school",
        "summary": "More families are choosing to educate at home. Supporters praise the flexibility; critics worry about social skills and standards.",
        "for": [
            "Lessons can move at each child's own pace.",
            "Children avoid bullying and large class sizes.",
            "Learning can follow a child's interests and the family's schedule.",
        ],
        "against": [
            "School teaches children to get along with a wide range of people.",
            "Trained teachers cover subjects most parents can't.",
            "Homeschooling is hard to check for quality and safety.",
        ],
    },
    {
        "id": "later-school-start", "slug": "school-should-start-later-for-teenagers", "tag": "Education",
        "motion": "School should start later for teenagers",
        "summary": "Teenagers' body clocks shift later during puberty, and many struggle with early starts. Should the school day move?",
        "for": [
            "Research on sleep suggests teens naturally fall asleep and wake later.",
            "Better-rested students tend to concentrate and behave better.",
            "Fewer tired teens on the roads in the morning is safer.",
        ],
        "against": [
            "A later finish clashes with after-school jobs, sport and family schedules.",
            "Teens might just stay up later.",
            "Changing bus and staff timetables would be expensive.",
        ],
    },
    {
        "id": "parents-be-friends", "slug": "parents-should-be-friends-with-their-kids", "tag": "Society",
        "motion": "Parents should be friends with their kids",
        "summary": "Some parents aim to be their child's best friend; others say kids need a parent, not a pal. Which works better?",
        "for": [
            "Kids who feel close to parents are more likely to come to them with problems.",
            "Friendship builds trust that lasts into adulthood.",
            "Strict, distant parenting can push teenagers to hide things.",
        ],
        "against": [
            "Children need someone to set limits, which friends don't do.",
            "Kids have friends their own age; they need a parent.",
            "Wanting to be liked can make it hard to say no.",
        ],
    },
    {
        "id": "grandparents-childcare", "slug": "grandparents-shouldnt-be-expected-to-do-childcare", "tag": "Society",
        "motion": "Grandparents shouldn't be expected to do childcare",
        "summary": "Many working parents rely on grandparents for free childcare. Is it a family duty or too much to ask?",
        "for": [
            "Grandparents have raised their own children and earned their free time.",
            "Regular childcare can be exhausting for older people.",
            "Expecting it can strain family relationships.",
        ],
        "against": [
            "Families have always shared the work of raising children.",
            "Many grandparents enjoy it and want the time with grandchildren.",
            "Childcare is so expensive that family help can be essential.",
        ],
    },
    {
        "id": "only-child", "slug": "being-an-only-child-is-better", "tag": "Society",
        "motion": "Being an only child is better",
        "summary": "Only children get all the attention and resources, but miss out on siblings. Is it a privilege or a loss?",
        "for": [
            "Parents can give more time, attention and money to one child.",
            "There's no sibling rivalry or comparison.",
            "Only children often become independent and comfortable on their own.",
        ],
        "against": [
            "Siblings teach sharing, compromise and conflict resolution.",
            "A brother or sister can be a lifelong friend.",
            "Caring for ageing parents falls on one person.",
        ],
    },

    # --- Technology ---
    {
        "id": "phones-at-concerts", "slug": "phones-should-be-banned-at-concerts", "tag": "Technology",
        "motion": "Phones should be banned at concerts",
        "summary": "Some artists now lock phones in pouches at shows. Fans are split between living in the moment and keeping a memory.",
        "for": [
            "A sea of screens blocks the view for everyone behind.",
            "People enjoy the show more when they aren't filming it.",
            "Artists should be able to control how their performance is shared.",
        ],
        "against": [
            "Fans paid for the ticket and want to keep a memory.",
            "Phones are needed for tickets, payments and emergencies.",
            "Fan videos are free promotion for artists.",
        ],
    },
    {
        "id": "kids-screen-time", "slug": "kids-screen-time-should-be-strictly-limited", "tag": "Technology",
        "motion": "Kids' screen time should be strictly limited",
        "summary": "Screens are everywhere in childhood now, from homework to friendships. Should parents set hard limits, or focus on what kids are watching?",
        "for": [
            "Too much screen time can crowd out sleep, exercise and play.",
            "Clear limits are easier to enforce than case-by-case rules.",
            "Many apps are designed to be hard to put down.",
        ],
        "against": [
            "Quality matters more than hours: a coding game isn't endless scrolling.",
            "Screens are where kids' friendships and schoolwork happen.",
            "Strict limits can make screens more tempting and cause fights.",
        ],
    },
    {
        "id": "smart-speakers-privacy", "slug": "smart-speakers-are-an-invasion-of-privacy", "tag": "Technology",
        "motion": "Smart speakers are an invasion of privacy",
        "summary": "Voice assistants sit in millions of homes, always listening for their wake word. Convenient helper or a microphone in your living room?",
        "for": [
            "Devices sometimes wake by accident and record private conversations.",
            "Companies collect data about your habits and routines.",
            "Recordings could be accessed by staff, hackers or authorities.",
        ],
        "against": [
            "They only send audio after hearing the wake word.",
            "Users can mute, review and delete recordings.",
            "Phones already collect far more data than speakers do.",
        ],
    },
    {
        "id": "ev-overhyped", "slug": "electric-cars-are-overhyped", "tag": "Technology",
        "motion": "Electric cars are overhyped",
        "summary": "Electric cars are pushed as the future of driving, but buyers still worry about price, range and charging. Are they ready for everyone?",
        "for": [
            "They still cost more upfront than similar petrol cars.",
            "Public charging can be patchy, slow or broken.",
            "Batteries need mining and are hard to recycle.",
        ],
        "against": [
            "They're far cheaper to run and maintain.",
            "Most daily journeys are well within their range.",
            "No exhaust fumes means cleaner air in towns and cities.",
        ],
    },
    {
        "id": "paid-verification", "slug": "paying-for-a-blue-tick-is-a-scam", "tag": "Technology",
        "motion": "Paying for a blue tick is a scam",
        "summary": "Several social platforms now sell verification badges by subscription. Is it a fair way to fund platforms or a con that confuses users?",
        "for": [
            "A badge used to mean 'this is really them'; now it just means 'they paid'.",
            "It makes impersonation easier for scammers who pay.",
            "Basic trust features shouldn't be locked behind a fee.",
        ],
        "against": [
            "Platforms need revenue, and this is optional.",
            "Paid checks can include ID verification that reduces fakes.",
            "It gives ordinary users access to perks once reserved for celebrities.",
        ],
    },
    {
        "id": "phone-at-dinner", "slug": "being-on-your-phone-at-dinner-is-rude", "tag": "Technology",
        "motion": "Being on your phone at dinner is rude",
        "summary": "Phones on the table are normal for many people now, but plenty still see it as disrespectful. Is checking your phone at a meal acceptable?",
        "for": [
            "It tells the people you're with that they're less interesting than your screen.",
            "Meals are one of the few times people talk without distractions.",
            "Even a phone face-down on the table can make conversation shallower.",
        ],
        "against": [
            "Quickly checking a message isn't a crime.",
            "People may need to be reachable for work, family or emergencies.",
            "Looking up a fact or sharing a photo can add to the conversation.",
        ],
    },
    {
        "id": "online-reviews", "slug": "online-reviews-cant-be-trusted", "tag": "Technology",
        "motion": "Online reviews can't be trusted",
        "summary": "Star ratings decide where we eat, stay and shop, but fake and paid-for reviews are a known problem. Are reviews still worth reading?",
        "for": [
            "Fake reviews can be bought cheaply and are hard to spot.",
            "Businesses sometimes offer freebies in exchange for five stars.",
            "Angry customers are more likely to post than happy ones.",
        ],
        "against": [
            "Large numbers of reviews usually reveal the truth over time.",
            "Platforms and regulators are cracking down on fakes.",
            "Detailed reviews with photos are still genuinely useful.",
        ],
    },

    # --- Everyday & unhinged ---
    {
        "id": "cats-vs-dogs", "slug": "cats-are-better-than-dogs", "tag": "Unhinged",
        "motion": "Cats are better than dogs",
        "summary": "The oldest pet argument there is. Independent and low-maintenance, or loyal and endlessly enthusiastic?",
        "for": [
            "Cats look after themselves and don't need walking.",
            "They suit small homes and busy lives.",
            "Their affection means more because they choose to give it.",
        ],
        "against": [
            "Dogs are loyal, playful and always happy to see you.",
            "Walking a dog gets you outdoors and meeting people.",
            "Dogs can be trained to help, protect and work.",
        ],
    },
    {
        "id": "breakfast-important", "slug": "breakfast-is-the-most-important-meal-of-the-day", "tag": "Unhinged",
        "motion": "Breakfast is the most important meal of the day",
        "summary": "It's one of the most repeated food sayings, but many people skip breakfast and feel fine. Is it really essential?",
        "for": [
            "A morning meal gives energy for work or school.",
            "Skipping it can lead to snacking on junk later.",
            "Children in particular concentrate better after eating.",
        ],
        "against": [
            "Plenty of people feel better eating later in the day.",
            "What you eat across the day matters more than when.",
            "Cereal companies helped make the saying popular.",
        ],
    },
    {
        "id": "irish-exit", "slug": "leaving-a-party-without-saying-goodbye-is-fine", "tag": "Unhinged",
        "motion": "Leaving a party without saying goodbye is fine",
        "summary": "Slipping out quietly, sometimes called an Irish goodbye, saves time and awkward farewells. Smart move or rude?",
        "for": [
            "Long goodbye rounds can take longer than the last hour of the party.",
            "It doesn't interrupt the host or other guests.",
            "A thank-you message afterwards does the same job.",
        ],
        "against": [
            "Thanking the host in person is basic manners.",
            "People may worry where you went.",
            "It can look like you didn't enjoy yourself.",
        ],
    },
    {
        "id": "pets-in-restaurants", "slug": "pets-should-be-allowed-in-restaurants", "tag": "Unhinged",
        "motion": "Pets should be allowed in restaurants",
        "summary": "Dog-friendly pubs and cafés are booming, but not every diner wants a pet at the next table. Should restaurants open up to animals?",
        "for": [
            "Owners can bring their pets instead of leaving them home alone.",
            "Many pubs and cafés already allow dogs without problems.",
            "It brings in more customers.",
        ],
        "against": [
            "Allergies and fear of dogs make some diners uncomfortable.",
            "Barking and begging disrupt meals.",
            "Animals around food raise hygiene concerns.",
        ],
    },
    {
        "id": "filming-at-gym", "slug": "filming-people-at-the-gym-should-be-banned", "tag": "Unhinged",
        "motion": "Filming people at the gym should be banned",
        "summary": "Gym content is huge online, and plenty of people film their workouts. But others end up in the background, or as the joke.",
        "for": [
            "People in the background never agreed to be filmed.",
            "Some creators film others to mock them.",
            "Tripods and filming take up space and equipment.",
        ],
        "against": [
            "Filming helps people check their form and track progress.",
            "Gym content inspires others to get fit.",
            "Rules on not filming others are fairer than a total ban.",
        ],
    },
    {
        "id": "tea-vs-coffee", "slug": "tea-is-better-than-coffee", "tag": "Unhinged",
        "motion": "Tea is better than coffee",
        "summary": "Two drinks, two tribes. Is the humble cup of tea superior to coffee, or is coffee the clear winner?",
        "for": [
            "Tea is gentler, with less caffeine and no crash.",
            "It's cheaper and quicker to make at home.",
            "There's a flavour of tea for every mood.",
        ],
        "against": [
            "Coffee gives a stronger, more reliable boost.",
            "Coffee shops are a whole culture of their own.",
            "Good coffee has more depth of flavour.",
        ],
    },
    {
        "id": "ketchup-fridge", "slug": "ketchup-belongs-in-the-fridge", "tag": "Unhinged",
        "motion": "Ketchup belongs in the fridge",
        "summary": "Fridge or cupboard? The ketchup question divides households and has surprisingly strong feelings on both sides.",
        "for": [
            "Most bottles say to refrigerate after opening.",
            "It keeps fresher and tastes better for longer.",
            "Cold ketchup is refreshing on hot food.",
        ],
        "against": [
            "It has enough vinegar and sugar to be fine in a cupboard.",
            "Restaurants and cafés often keep it on the table.",
            "Cold ketchup cools your chips down.",
        ],
    },
    {
        "id": "call-without-text", "slug": "calling-without-texting-first-is-rude", "tag": "Unhinged",
        "motion": "Calling someone without texting first is rude",
        "summary": "Many people now expect a text before a phone call. Others think that's ridiculous. Is an unannounced call an intrusion?",
        "for": [
            "A surprise call demands attention right now, wherever you are.",
            "A quick text lets the other person choose a good time.",
            "Unexpected calls often mean bad news, which causes worry.",
        ],
        "against": [
            "Phones were made for calling.",
            "A call is faster than a long text back and forth.",
            "If it's a bad time, people can simply not answer.",
        ],
    },
    {
        "id": "public-fireworks", "slug": "fireworks-should-be-banned-for-public-sale", "tag": "Society",
        "motion": "Fireworks should be banned for public sale",
        "summary": "Back gardens fill with fireworks every autumn. Some people love it; others worry about pets, injuries and noise. Should only organised displays be allowed?",
        "for": [
            "Loud bangs frighten pets, wildlife and some people with PTSD.",
            "Injuries from home fireworks happen every year.",
            "Organised displays are safer and better anyway.",
        ],
        "against": [
            "Families enjoy their own small celebrations at home.",
            "Most people use them safely and responsibly.",
            "Bans tend to push sales underground.",
        ],
    },
    {
        "id": "customer-not-always-right", "slug": "the-customer-is-not-always-right", "tag": "Society",
        "motion": "The customer is not always right",
        "summary": "The old retail motto says the customer is always right. Many shop and hospitality workers would disagree.",
        "for": [
            "Treating every demand as right encourages rude behaviour.",
            "Staff deserve protection from abuse.",
            "Customers are sometimes simply wrong about the facts.",
        ],
        "against": [
            "Without customers there's no business.",
            "Good service means going out of your way to solve problems.",
            "A happy customer comes back and tells others.",
        ],
    },
    {
        "id": "talking-at-cinema", "slug": "talking-during-a-film-should-get-you-thrown-out", "tag": "Movies & TV",
        "motion": "Talking during a film should get you thrown out of the cinema",
        "summary": "Cinema tickets aren't cheap, and a chatty row can ruin a film. Should cinemas enforce silence more strictly?",
        "for": [
            "Everyone paid to hear the film, not the conversation.",
            "A warning-then-removal rule would stop most of it.",
            "Phones and chatting are the top cinema complaints.",
        ],
        "against": [
            "A quick whisper isn't worth throwing someone out.",
            "Some screenings, like family or party showings, are meant to be lively.",
            "Staff can't police every row.",
        ],
    },
    {
        "id": "gen-z-harder", "slug": "gen-z-has-it-harder-than-millennials", "tag": "Society",
        "motion": "Gen Z has it harder than millennials",
        "summary": "Every generation claims to have it toughest. Gen Z points to housing, social media and job markets; millennials point to the 2008 crash.",
        "for": [
            "House prices relative to wages are even further out of reach.",
            "Growing up on social media brings constant comparison and pressure.",
            "The pandemic disrupted school and early careers.",
        ],
        "against": [
            "Millennials entered work during a global financial crash.",
            "Gen Z has more tools for learning and earning online.",
            "Every generation faces different, not simply worse, problems.",
        ],
    },
    {
        "id": "daylight-saving", "slug": "the-clocks-should-stop-changing", "tag": "Society",
        "motion": "The clocks should stop changing",
        "summary": "Twice a year the clocks go forward and back. Many people find it disruptive. Should we pick one time and keep it?",
        "for": [
            "The change disrupts sleep, especially for children and shift workers.",
            "Its original reasons matter much less today.",
            "Fixed time would be simpler for everyone.",
        ],
        "against": [
            "Without it, winter mornings or summer evenings would be much darker.",
            "Lighter evenings are good for leisure and road safety.",
            "Countries would need to agree to avoid confusion.",
        ],
    },
    {
        "id": "penalty-shootouts", "slug": "penalty-shootouts-are-an-unfair-way-to-decide-matches", "tag": "Sports",
        "motion": "Penalty shootouts are an unfair way to decide matches",
        "summary": "Big tournaments are often decided from the spot. Is a shootout a fair test of nerve, or a lottery after 120 minutes of football?",
        "for": [
            "One kick can undo a whole match of better play.",
            "It tests a skill that's rare in normal play.",
            "Many fans call it a lottery for a reason.",
        ],
        "against": [
            "It's dramatic, fast and decisive.",
            "Nerve under pressure is part of sport.",
            "Teams can practise penalties like any other skill.",
        ],
    },
    {
        "id": "enhanced-athletes", "slug": "athletes-should-be-allowed-to-use-performance-enhancing-drugs", "tag": "Sports",
        "motion": "Athletes should be allowed to use performance-enhancing drugs",
        "summary": "Doping scandals keep hitting sport. Some argue legal, supervised enhancement would be fairer and safer than the current cat-and-mouse.",
        "for": [
            "Testing can't catch everyone, so honest athletes are disadvantaged.",
            "Medical supervision would be safer than secret doping.",
            "We already allow other enhancements like altitude training and supplements.",
        ],
        "against": [
            "It would pressure every athlete to risk their health.",
            "Sport should test natural talent and training.",
            "Young athletes would copy what the pros do.",
        ],
    },
    {
        "id": "chatgpt-homework", "slug": "students-should-be-allowed-to-use-chatgpt", "tag": "Education",
        "motion": "Students should be allowed to use ChatGPT for schoolwork",
        "summary": "AI chatbots can explain topics and draft essays in seconds. Should schools teach students to use them, or ban them?",
        "for": [
            "Students will use AI at work, so they should learn to use it well.",
            "It can explain things patiently, like a free tutor.",
            "Bans are almost impossible to enforce.",
        ],
        "against": [
            "Students who let AI write for them don't learn to think or write.",
            "It can confidently give wrong answers.",
            "It makes it harder to assess what a student really knows.",
        ],
    },
    {
        "id": "ai-take-jobs", "slug": "ai-will-take-your-job", "tag": "Technology",
        "motion": "AI will take your job",
        "summary": "AI tools can now write, code, design and answer customers. Will they replace most workers, or just change what work looks like?",
        "for": [
            "AI can already do tasks that took people hours, for almost nothing.",
            "Companies have strong incentives to cut costs.",
            "Even skilled office jobs are exposed, not just manual ones.",
        ],
        "against": [
            "New technology has always created new kinds of jobs.",
            "Most jobs involve judgement and people skills AI lacks.",
            "AI is more likely to change jobs than erase them.",
        ],
    },
    {
        "id": "christmas-commercial", "slug": "christmas-has-become-too-commercial", "tag": "Society",
        "motion": "Christmas has become too commercial",
        "summary": "Decorations in shops from October, Black Friday, endless adverts. Has Christmas become more about spending than anything else?",
        "for": [
            "Pressure to buy expensive gifts pushes families into debt.",
            "Shops stretch the season earlier every year.",
            "Adverts tell people love is measured by spending.",
        ],
        "against": [
            "People can celebrate however they like, simply or lavishly.",
            "Seasonal spending supports jobs and small businesses.",
            "Giving gifts is a long-standing and joyful tradition.",
        ],
    },
]
