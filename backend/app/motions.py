"""Curated debate motions: the no-sign-up sparring list and the public
/motions pages that search engines index. Each has a short neutral summary
and the three strongest arguments on each side, so the page is useful on
its own before anyone starts a round."""

MOTIONS = [
    {
        "id": "remote-work", "slug": "remote-work-is-better-than-the-office", "tag": "Technology",
        "motion": "Remote work is better than working in an office",
        "summary": "Since 2020 millions of jobs have moved partly or fully online. Companies now argue over return-to-office mandates while many workers say they will not go back.",
        "for": [
            "No commute gives people back hours every week, cuts travel costs and lowers emissions.",
            "Employers can hire from anywhere, which widens the talent pool and opens jobs to people outside expensive cities.",
            "Many people do focused work better at home, away from open-plan noise and constant interruptions.",
        ],
        "against": [
            "Junior staff learn faster by watching and overhearing colleagues, which is hard to replace on video calls.",
            "Spontaneous conversations spark ideas and build trust across teams in a way scheduled calls rarely do.",
            "Working where you live blurs the line between work and home and can leave people isolated.",
        ],
    },
    {
        "id": "ai-jobs", "slug": "ai-will-create-more-jobs-than-it-destroys", "tag": "Technology",
        "motion": "AI will create more jobs than it destroys",
        "summary": "AI tools can now write, code, draw and answer customers. Some see the next industrial revolution; others see the first technology that replaces thinking work itself.",
        "for": [
            "Every past wave of automation, from looms to computers, ended up creating more jobs than it removed.",
            "Cheaper intelligence lowers the cost of starting businesses and products, which creates new demand and new roles.",
            "Whole job categories, from AI safety to data work, did not exist a few years ago.",
        ],
        "against": [
            "Earlier machines replaced muscle; AI replaces judgement, so there may be no new kind of work left to move into.",
            "The change is happening in years, not generations, faster than people can retrain.",
            "The gains may flow to a few companies that own the models, while wages for ordinary work fall.",
        ],
    },
    {
        "id": "social-media-teens", "slug": "under-16s-should-be-banned-from-social-media", "tag": "Technology",
        "motion": "Under-16s should be banned from social media",
        "summary": "Several countries have passed or proposed minimum ages for social media. Parents and researchers disagree on how much harm it does and whether a ban can work.",
        "for": [
            "Feeds built to maximise attention are linked to worse sleep, anxiety and body-image problems in young teens.",
            "A legal age line takes pressure off individual parents, since no child is the only one left out.",
            "Children cannot meaningfully consent to how platforms collect and use their data.",
        ],
        "against": [
            "Teens will get around age checks, pushing them to less moderated corners of the internet.",
            "Social media is where many young people find community, especially those isolated where they live.",
            "Age verification for everyone means handing ID or face scans to tech companies, a privacy cost for all users.",
        ],
    },
    {
        "id": "athlete-pay", "slug": "top-athletes-are-overpaid", "tag": "Sports",
        "motion": "Top athletes are overpaid",
        "summary": "The best-paid athletes earn tens of millions a year from salaries and sponsorships, more than most nurses, teachers or scientists earn in a lifetime.",
        "for": [
            "Pay this high for playing a game shows society values entertainment over essential work.",
            "The money comes from ticket prices, TV subscriptions and merchandise paid for by ordinary fans.",
            "Huge pay at the top hides the fact that most professional athletes have modest, short careers.",
        ],
        "against": [
            "Athletes are paid from the revenue they generate; if they earned less, owners would simply keep more.",
            "Careers are short and injuries common, so peak earnings must cover a lifetime.",
            "Reaching the top takes rare talent and years of sacrifice that only a tiny few succeed at.",
        ],
    },
    {
        "id": "four-day-week", "slug": "every-country-should-move-to-a-four-day-week", "tag": "Politics",
        "motion": "Every country should move to a four-day work week",
        "summary": "Trials in several countries have tested working four days for the same pay. Supporters cite wellbeing and productivity; critics doubt it works outside offices.",
        "for": [
            "Trials have reported similar output with less burnout and fewer sick days.",
            "A shorter week makes jobs more attractive, helping employers hire and keep staff.",
            "An extra day off gives time for family, health and caring responsibilities that mostly fall on women.",
        ],
        "against": [
            "Hospitals, shops, schools and factories need people present, so a fixed four-day week does not fit every job.",
            "Companies that volunteer for trials are not typical, so results may not hold across a whole economy.",
            "Squeezing five days of work into four can raise stress rather than reduce it.",
        ],
    },
    {
        "id": "voting-age", "slug": "the-voting-age-should-be-lowered-to-16", "tag": "Politics",
        "motion": "The voting age should be lowered to 16",
        "summary": "Some countries and regions already let 16-year-olds vote. Others argue 18 is the right line for adult decisions.",
        "for": [
            "Many 16-year-olds work and pay tax, so they should have a say in the laws they live under.",
            "Voting habits form early; people who vote in their first election are more likely to keep voting.",
            "Decisions on climate, housing and debt affect young people longest, yet they have no vote on them.",
        ],
        "against": [
            "Most legal adult responsibilities start at 18, and the vote should line up with them.",
            "Many 16-year-olds still live with their parents and may vote under their influence.",
            "Young people already have the lowest turnout, so a lower age may add little real participation.",
        ],
    },
    {
        "id": "meat-tax", "slug": "meat-should-be-taxed-like-cigarettes", "tag": "Science",
        "motion": "Meat should be taxed like cigarettes",
        "summary": "Livestock farming is a major source of greenhouse gas emissions, and processed meat is linked to health risks. Some economists propose taxing it to change diets.",
        "for": [
            "The price of meat ignores the climate and health costs it creates, which the public pays for later.",
            "Taxes on tobacco and sugary drinks reduced consumption, and the same tool would work here.",
            "The money raised could make fruit, vegetables and plant proteins cheaper.",
        ],
        "against": [
            "Food taxes hit poorer households hardest, since food takes a larger share of their income.",
            "Eating meat is not comparable to smoking: in moderation it can be part of a healthy diet.",
            "It would hurt farmers and rural economies while production moves to countries with weaker rules.",
        ],
    },
    {
        "id": "space", "slug": "spending-on-space-exploration-is-worth-it", "tag": "Science",
        "motion": "Spending on space exploration is worth it",
        "summary": "Governments and billionaires spend billions on rockets, Moon bases and Mars plans while problems on Earth go unsolved.",
        "for": [
            "Space research gave us satellites, weather forecasting, GPS and many technologies we now rely on.",
            "Watching Earth from orbit is essential for tracking climate change, disasters and crops.",
            "Big shared goals inspire people to study science and engineering.",
        ],
        "against": [
            "The same money could tackle poverty, disease and climate change directly and with surer results.",
            "Much of the new spending serves national prestige or private ventures rather than science.",
            "Earth's problems are urgent; Mars colonies are decades away and may never be practical.",
        ],
    },
    {
        "id": "remakes", "slug": "hollywood-remakes-are-ruining-cinema", "tag": "Movies & TV",
        "motion": "Hollywood remakes are ruining cinema",
        "summary": "Remakes, reboots and sequels dominate the biggest releases. Some say studios have stopped taking risks; others say retelling stories is as old as storytelling.",
        "for": [
            "Studios put their biggest budgets behind familiar brands, leaving less money and screen space for original films.",
            "Many remakes copy what worked before without adding anything new.",
            "Audiences learn to expect the familiar, which makes it even harder for new stories to succeed.",
        ],
        "against": [
            "Retelling stories is how culture works: Shakespeare borrowed most of his plots.",
            "Some remakes are better than the originals and bring old stories to new generations.",
            "Original films are still made; many have moved to streaming and independent studios.",
        ],
    },
    {
        "id": "homework", "slug": "schools-should-abolish-homework", "tag": "Education",
        "motion": "Schools should abolish homework",
        "summary": "Homework has been part of school for generations, but some schools now set little or none, saying it adds stress without improving learning.",
        "for": [
            "Studies find little benefit from homework for younger children.",
            "Homework widens gaps: children with quiet space and help at home do better than those without.",
            "Evenings free of schoolwork leave time for rest, family, play and sleep, which also support learning.",
        ],
        "against": [
            "Practice outside class helps lock in what was taught, especially in maths and languages.",
            "Homework builds independence and time management that students need later.",
            "It shows parents what their child is learning and where they struggle.",
        ],
    },
]

MOTIONS_BY_ID = {m["id"]: m for m in MOTIONS}
MOTIONS_BY_SLUG = {m["slug"]: m for m in MOTIONS}
