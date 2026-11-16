"""More curated motions for the public /motions library (search pages) and guest sparring.
Same shape as motions.MOTIONS: a neutral two-sentence summary and the three strongest
arguments on each side. Appended to MOTIONS in motions.py."""

EXTRA_MOTIONS = [
    # --- Education ---
    {
        "id": "university-worth", "slug": "university-is-worth-the-debt", "tag": "Education",
        "motion": "University is worth the debt",
        "summary": "Tuition and living costs leave many graduates owing tens of thousands. At the same time, more employers are dropping degree requirements and online courses are cheaper than ever.",
        "for": [
            "On average, graduates still earn more over their working lives than people without degrees.",
            "Many careers, from medicine to law to teaching, legally require a degree.",
            "University builds networks, independence and ways of thinking that are hard to get from online courses.",
        ],
        "against": [
            "Tuition has risen far faster than graduate wages, so the payoff is shrinking for many subjects.",
            "Apprenticeships and online learning can teach job-ready skills without the debt.",
            "Large employers increasingly hire on skills rather than degrees, weakening the main reason to go.",
        ],
    },
    {
        "id": "phones-schools", "slug": "phones-should-be-banned-in-schools", "tag": "Education",
        "motion": "Phones should be banned in schools",
        "summary": "A growing number of countries and schools now ban phones for the whole school day. Supporters point to focus and wellbeing; critics say a ban doesn't teach responsible use.",
        "for": [
            "Schools that remove phones often report calmer classrooms and better concentration.",
            "Without phones, break times become face-to-face again, which helps friendships.",
            "It reduces in-school cyberbullying and filming of other students.",
        ],
        "against": [
            "Parents want to reach their children, especially in an emergency.",
            "Phones can be useful learning tools for research, maps, calculators and translation.",
            "Teaching sensible use prepares students for adult life better than a blanket ban.",
        ],
    },
    {
        "id": "school-uniforms", "slug": "school-uniforms-should-be-scrapped", "tag": "Education",
        "motion": "School uniforms should be scrapped",
        "summary": "Uniforms are standard in many countries and rare in others. The debate covers cost, equality, discipline and self-expression.",
        "for": [
            "Branded uniforms can be expensive, a real burden for poorer families.",
            "Choosing what to wear is a basic form of self-expression young people should have.",
            "Strict uniform rules lead to pointless punishments that disrupt learning.",
        ],
        "against": [
            "Uniforms hide differences in family wealth and reduce pressure to wear expensive brands.",
            "They create a sense of belonging and a clear line between school and home.",
            "Mornings are simpler, and there are fewer arguments about what is appropriate.",
        ],
    },
    {
        "id": "ai-homework", "slug": "using-ai-for-homework-is-cheating", "tag": "Education",
        "motion": "Using AI for homework is cheating",
        "summary": "Chatbots can now write essays and solve problems in seconds. Schools are split between banning them and teaching students to use them well.",
        "for": [
            "Homework exists to make students do the thinking; letting AI do it defeats the purpose.",
            "It hides what a student actually understands from the teacher.",
            "It is unfair to students who do the work themselves.",
        ],
        "against": [
            "Calculators and spell-checkers were once called cheating too; tools change what we test.",
            "Using AI well is a real skill students will need at work.",
            "If AI can do an assignment, the assignment should change, not the student.",
        ],
    },
    {
        "id": "debate-compulsory", "slug": "debate-should-be-taught-in-every-school", "tag": "Education",
        "motion": "Debate should be taught in every school",
        "summary": "Debating is often a club for confident students. Some argue it should be part of every timetable because it teaches thinking and speaking skills everyone needs.",
        "for": [
            "Arguing a case builds critical thinking, research and public speaking skills that help in every career.",
            "Having to argue the other side teaches students to understand people they disagree with.",
            "It gives quieter students practice and confidence they rarely get otherwise.",
        ],
        "against": [
            "The timetable is already full, and something else would have to be cut.",
            "Forced public speaking can be distressing for anxious students.",
            "Competitive debate can reward clever style over honest reasoning.",
        ],
    },
    {
        "id": "exams-abolish", "slug": "exams-should-be-replaced-by-coursework", "tag": "Education",
        "motion": "Exams should be replaced by coursework",
        "summary": "Final exams decide many students' futures in a few hours. Coursework spreads assessment across the year, but has its own problems with fairness and cheating.",
        "for": [
            "One bad day or a bout of anxiety can unfairly define years of work.",
            "Coursework rewards research and sustained effort, closer to how real work happens.",
            "Exam cramming encourages memorising and forgetting rather than understanding.",
        ],
        "against": [
            "Coursework is easier to cheat on, especially now that AI can write it.",
            "Students with more help at home gain an advantage that exams reduce.",
            "Exams test what a student can do alone, under the same conditions as everyone else.",
        ],
    },
    # --- Technology ---
    {
        "id": "self-driving", "slug": "self-driving-cars-will-be-safer-than-human-drivers", "tag": "Technology",
        "motion": "Self-driving cars will be safer than human drivers",
        "summary": "Robotaxis already carry passengers in several cities. The question is whether software can handle the messy reality of roads better than people.",
        "for": [
            "Most crashes involve human error such as distraction, speeding or drink-driving.",
            "Computers don't get tired, angry or drunk, and they watch in every direction at once.",
            "Every car learns from the mistakes of the whole fleet, which human drivers can't.",
        ],
        "against": [
            "Self-driving systems still fail in rare, unusual situations that humans handle easily.",
            "It's unclear who is responsible when an automated car causes a crash.",
            "Connected fleets create a new risk: one hack or software bug could affect thousands of cars.",
        ],
    },
    {
        "id": "ai-art", "slug": "ai-generated-art-is-real-art", "tag": "Technology",
        "motion": "AI-generated art is real art",
        "summary": "Image generators can produce striking pictures from a sentence. Artists argue about whether that counts as art, and whether the models were built on their work without consent.",
        "for": [
            "Art has always used new tools, from cameras to digital software, and each was dismissed at first.",
            "Choosing the idea, refining the prompt and selecting the result are creative decisions.",
            "Viewers can be genuinely moved by an image whoever, or whatever, made it.",
        ],
        "against": [
            "Art expresses a person's experience and intention; a model has neither.",
            "Many models were trained on artists' work without permission or payment.",
            "Typing a prompt takes seconds, so calling the output art devalues real craft.",
        ],
    },
    {
        "id": "anonymous-accounts", "slug": "anonymous-social-media-accounts-should-be-banned", "tag": "Technology",
        "motion": "Anonymous social media accounts should be banned",
        "summary": "Online abuse often comes from accounts with no real name attached. Requiring verified identities might reduce it, but anonymity also protects vulnerable people.",
        "for": [
            "People say things anonymously that they would never say under their own name.",
            "Verified accounts make it easier to stop abuse, scams and bot networks.",
            "It would make it harder to spread coordinated misinformation with fake accounts.",
        ],
        "against": [
            "Anonymity protects whistleblowers, abuse survivors and people in repressive countries.",
            "Plenty of abuse is posted under real names, so a ban may change little.",
            "Handing ID to platforms creates huge privacy and data-breach risks.",
        ],
    },
    {
        "id": "dating-apps", "slug": "dating-apps-have-made-dating-worse", "tag": "Technology",
        "motion": "Dating apps have made dating worse",
        "summary": "Apps are now one of the most common ways couples meet. Yet many users describe burnout, ghosting and endless swiping.",
        "for": [
            "Endless choice makes people less willing to commit to anyone.",
            "Judging people on a few photos rewards looks over personality.",
            "Ghosting and rudeness are easier when the other person feels like a profile, not a person.",
        ],
        "against": [
            "Millions of long-term couples met on apps who would never have met otherwise.",
            "They help shy, busy or isolated people meet others beyond their immediate circle.",
            "Dating was never easy; apps just made the frustrations more visible.",
        ],
    },
    {
        "id": "cash-free", "slug": "cash-should-be-phased-out", "tag": "Technology",
        "motion": "Cash should be phased out",
        "summary": "In many countries most payments are already digital and some shops refuse cash. Others warn that a cashless society leaves people behind.",
        "for": [
            "Digital payments are faster, and lost cards can be cancelled while lost cash is gone.",
            "Cash makes tax evasion, money laundering and some crime easier.",
            "Handling, counting and transporting cash costs businesses money.",
        ],
        "against": [
            "Older people, poorer people and those without bank accounts rely on cash.",
            "Without cash, every purchase can be tracked by banks and governments.",
            "Power cuts, outages or cyberattacks could stop people paying for anything.",
        ],
    },
    {
        "id": "deepfakes-ban", "slug": "deepfakes-should-be-illegal", "tag": "Technology",
        "motion": "Making deepfakes of real people should be illegal",
        "summary": "AI can now make convincing videos of anyone saying or doing anything. Some uses are harmless parody; others are fraud, harassment or political deception.",
        "for": [
            "Deepfakes are used to harass people, especially with fake explicit images.",
            "Fake videos of politicians can mislead voters before anyone can correct them.",
            "Scammers already use cloned voices and faces to trick people out of money.",
        ],
        "against": [
            "Parody and satire of public figures have a long history and deserve protection.",
            "Existing laws on fraud, defamation and harassment already cover the harmful uses.",
            "A broad ban would be impossible to enforce against anonymous creators abroad.",
        ],
    },
    {
        "id": "algorithms", "slug": "social-media-algorithms-do-more-harm-than-good", "tag": "Technology",
        "motion": "Social media algorithms do more harm than good",
        "summary": "Feeds decide what billions of people see each day. They surface things we enjoy, but they also optimise for attention above everything else.",
        "for": [
            "Algorithms reward outrage because anger keeps people scrolling and sharing.",
            "They can push vulnerable users towards extreme or harmful content.",
            "They're designed to maximise screen time, not wellbeing.",
        ],
        "against": [
            "Without them, feeds would be an unsorted flood that nobody could use.",
            "They help small creators find an audience without big marketing budgets.",
            "People enjoy recommendations that match their interests; that's why they keep using them.",
        ],
    },
    # --- Society ---
    {
        "id": "cancel-culture", "slug": "cancel-culture-has-gone-too-far", "tag": "Society",
        "motion": "Cancel culture has gone too far",
        "summary": "Public figures and ordinary people have lost jobs and reputations over things they said, sometimes years earlier. Is that accountability or mob justice?",
        "for": [
            "People can lose their livelihoods over old jokes or a single badly worded post.",
            "Online pile-ons skip any fair process, context or chance to apologise.",
            "Fear of being cancelled makes people stop saying what they actually think.",
        ],
        "against": [
            "Facing criticism for public behaviour is just accountability.",
            "Many powerful people who were 'cancelled' kept their careers.",
            "Choosing not to support someone is itself a form of free expression.",
        ],
    },
    {
        "id": "free-speech", "slug": "free-speech-should-include-offensive-speech", "tag": "Society",
        "motion": "Free speech should include speech that offends",
        "summary": "Most people support free speech in principle. The fight is over where the limits should be and who gets to set them.",
        "for": [
            "Whoever decides what counts as offensive holds enormous power over debate.",
            "Bad ideas are best defeated in the open, not driven underground.",
            "Many ideas now widely accepted were once considered deeply offensive.",
        ],
        "against": [
            "Some speech incites violence or harassment and causes real harm.",
            "Private platforms aren't obliged to host everything anyone wants to say.",
            "Abuse can silence the people it targets, which also limits free speech.",
        ],
    },
    {
        "id": "celebrity-politics", "slug": "celebrities-should-stay-out-of-politics", "tag": "Society",
        "motion": "Celebrities should stay out of politics",
        "summary": "Actors, musicians and athletes regularly endorse candidates and causes. Fans are split between welcoming it and wishing they'd stick to their day job.",
        "for": [
            "Fame doesn't give anyone expertise in economics or foreign policy.",
            "Celebrities can sway millions of fans who trust them for the wrong reasons.",
            "They rarely live with the consequences of the policies they promote.",
        ],
        "against": [
            "Celebrities are citizens with the same right to speak as anyone else.",
            "They can draw attention to important issues that would otherwise be ignored.",
            "Nobody is forced to listen; fans can make up their own minds.",
        ],
    },
    {
        "id": "influencer-job", "slug": "being-an-influencer-is-a-real-job", "tag": "Society",
        "motion": "Being an influencer is a real job",
        "summary": "Many young people now say they want to be content creators. Some creators earn more than doctors; most earn very little.",
        "for": [
            "Top creators run real businesses with staff, contracts and serious income.",
            "It takes skills in filming, editing, writing, marketing and negotiation.",
            "Brands spend billions on creator marketing because it works.",
        ],
        "against": [
            "Most people who try earn little or nothing.",
            "A career that depends on an algorithm can disappear overnight.",
            "Much of it produces attention rather than anything of lasting value.",
        ],
    },
    {
        "id": "marriage-outdated", "slug": "marriage-is-outdated", "tag": "Society",
        "motion": "Marriage is outdated",
        "summary": "Fewer people are marrying, and many couples live together for decades without doing so. Others still see marriage as the foundation of family life.",
        "for": [
            "Couples can make a lifelong commitment without involving the state or a ceremony.",
            "A large share of marriages end in divorce, which can be costly and painful.",
            "Weddings often cost a fortune that could go towards a home or savings.",
        ],
        "against": [
            "Marriage gives partners and children legal protections around property, inheritance and care.",
            "Making a public promise can strengthen commitment through hard times.",
            "For many people it carries cultural and personal meaning that matters to them.",
        ],
    },
    {
        "id": "monarchy", "slug": "the-monarchy-should-be-abolished", "tag": "Society",
        "motion": "The monarchy should be abolished",
        "summary": "Several countries still have hereditary monarchs as heads of state. Supporters value tradition and stability; critics object to power and privilege by birth.",
        "for": [
            "Nobody should become head of state simply because of who their parents were.",
            "Public money supports a family's lifestyle and security.",
            "An elected head of state would be more democratic and accountable.",
        ],
        "against": [
            "A monarch above party politics can unite people in a way politicians can't.",
            "The monarchy attracts tourism and gives the country global soft power.",
            "It's a living part of national history and identity for many people.",
        ],
    },
    {
        "id": "zoos", "slug": "zoos-should-be-closed", "tag": "Society",
        "motion": "Zoos should be closed",
        "summary": "Modern zoos describe themselves as conservation centres. Critics argue that keeping wild animals in enclosures can never be justified.",
        "for": [
            "Large, wide-ranging animals like elephants and orcas suffer in limited spaces.",
            "Watching animals behind glass teaches little about how they live in the wild.",
            "The money could protect habitats where animals actually live.",
        ],
        "against": [
            "Breeding programmes have saved several species from extinction.",
            "Zoos fund research and conservation work in the wild.",
            "Seeing animals up close makes children care about protecting wildlife.",
        ],
    },
    {
        "id": "true-crime", "slug": "true-crime-entertainment-is-exploitative", "tag": "Society",
        "motion": "True crime entertainment is exploitative",
        "summary": "True crime podcasts and documentaries are hugely popular. Victims' families sometimes object to their worst days becoming entertainment.",
        "for": [
            "Victims' families rarely consent to their tragedy becoming a hit series.",
            "Some shows glamorise killers and turn them into celebrities.",
            "Amateur sleuths have harassed innocent people after watching.",
        ],
        "against": [
            "Some true crime coverage has helped reopen cases and free wrongly convicted people.",
            "It raises awareness of how crimes happen and how to stay safe.",
            "Stories about crime have always been part of journalism and literature.",
        ],
    },
    {
        "id": "dog-licence", "slug": "people-should-need-a-licence-to-own-a-dog", "tag": "Society",
        "motion": "People should need a licence to own a dog",
        "summary": "Some countries require dog licences or owner tests; others dropped them. Supporters say it would cut neglect and attacks.",
        "for": [
            "A test would make sure owners understand training, exercise and costs before buying.",
            "Licence fees could fund rescue centres and enforcement.",
            "It would reduce impulse buying and the abandonment that follows.",
        ],
        "against": [
            "Responsible owners would pay, while irresponsible ones would ignore it.",
            "It would make pets less affordable for poorer families who care for them well.",
            "Existing animal welfare laws could be enforced instead.",
        ],
    },
    {
        "id": "kids-online-parents", "slug": "parents-should-not-post-their-children-online", "tag": "Society",
        "motion": "Parents shouldn't post their children online",
        "summary": "Many children have a digital footprint before they can talk. Some grown-up children now resent the photos and stories their parents shared.",
        "for": [
            "Children can't consent to having their lives shared publicly.",
            "Photos and details can be misused by strangers or follow children into adulthood.",
            "Family vlogs can turn childhood into unpaid work for an audience.",
        ],
        "against": [
            "Sharing family moments with relatives and friends is a normal part of life.",
            "Most parents post thoughtfully and keep their accounts private.",
            "A ban would be impossible to enforce and would intrude on family life.",
        ],
    },
    # --- Money & Work ---
    {
        "id": "ubi", "slug": "every-adult-should-get-a-universal-basic-income", "tag": "Money & Work",
        "motion": "Every adult should get a universal basic income",
        "summary": "A universal basic income would pay every adult a regular sum with no conditions. Trials have taken place in several countries with mixed and debated results.",
        "for": [
            "It removes benefit traps where earning more leaves people worse off.",
            "It gives people security as automation changes the job market.",
            "Paying everyone avoids costly and stigmatising means testing.",
        ],
        "against": [
            "Paying every adult a meaningful amount would be enormously expensive.",
            "Extra money in everyone's pocket could push up rents and prices.",
            "Targeted help reaches the people who need it most more efficiently.",
        ],
    },
    {
        "id": "billionaires", "slug": "billionaires-should-not-exist", "tag": "Money & Work",
        "motion": "Billionaires shouldn't exist",
        "summary": "The number of billionaires and the size of their fortunes have grown fast. Some call for wealth caps; others say great wealth is the reward for building great companies.",
        "for": [
            "No one earns a billion through their own work alone; it depends on employees and public infrastructure.",
            "Extreme wealth can buy political influence that ordinary people don't have.",
            "That money could fund health, education and housing.",
        ],
        "against": [
            "Most billionaire wealth is shares in companies they built, not cash in a vault.",
            "The chance of huge rewards encourages people to take risks and innovate.",
            "Capping wealth could push founders and companies to other countries.",
        ],
    },
    {
        "id": "tipping", "slug": "tipping-should-be-replaced-by-fair-wages", "tag": "Money & Work",
        "motion": "Tipping should be replaced by fair wages",
        "summary": "Tipping norms vary hugely between countries, and card machines now ask for tips almost everywhere. Some restaurants have scrapped tipping in favour of higher pay.",
        "for": [
            "Staff income shouldn't depend on customers' moods, or on bias.",
            "Tipping prompts on every screen pressure customers uncomfortably.",
            "Fixed wages are fairer to kitchen staff who rarely share in tips.",
        ],
        "against": [
            "Tips reward great service and give staff a reason to go the extra mile.",
            "Menu prices would rise to cover higher wages.",
            "In busy restaurants, many servers earn more through tips than a fixed wage would pay.",
        ],
    },
    {
        "id": "rich-luck", "slug": "being-rich-is-mostly-luck", "tag": "Money & Work",
        "motion": "Being rich is mostly down to luck",
        "summary": "Some people credit their success to hard work and smart decisions. Others point to the role of birth, timing and connections.",
        "for": [
            "Where and to whom you're born shapes education, health and opportunities enormously.",
            "Inheritance and family connections give some people a huge head start.",
            "Many people work extremely hard their whole lives and never become wealthy.",
        ],
        "against": [
            "Discipline, skill and willingness to take risks still separate outcomes.",
            "Many successful people started with very little.",
            "Luck matters most for people who keep trying and are ready when chances come.",
        ],
    },
    {
        "id": "job-hopping", "slug": "you-should-change-jobs-every-two-years", "tag": "Money & Work",
        "motion": "You should change jobs every two years",
        "summary": "Pay rises from switching employers are often bigger than raises for staying put. But loyalty, depth and stability matter too.",
        "for": [
            "Changing employers is often the fastest way to a significant pay rise.",
            "New roles build broader skills and a bigger network.",
            "Companies rarely reward loyalty when they restructure or make cuts.",
        ],
        "against": [
            "Real expertise and major projects take longer than two years.",
            "Frequent moves can look unreliable to some employers.",
            "Staying lets you build trust that leads to promotions and better opportunities.",
        ],
    },
    {
        "id": "unpaid-internships", "slug": "unpaid-internships-should-be-illegal", "tag": "Money & Work",
        "motion": "Unpaid internships should be illegal",
        "summary": "In some industries unpaid internships are the usual way in. Critics say they lock out anyone who can't afford to work for free.",
        "for": [
            "Only people whose families can support them can afford to work for free.",
            "Interns often do real work that should be paid.",
            "It keeps industries like media, fashion and politics dominated by the wealthy.",
        ],
        "against": [
            "Some organisations, like small charities, can't afford to pay but can offer experience.",
            "A ban could mean fewer opportunities overall.",
            "Short unpaid placements can be valuable learning, not exploitation.",
        ],
    },
    {
        "id": "salary-transparency", "slug": "salaries-should-be-public", "tag": "Money & Work",
        "motion": "Everyone's salary should be public",
        "summary": "Some countries publish everyone's tax records, and some companies share all salaries internally. Supporters say it closes pay gaps; others value privacy.",
        "for": [
            "Pay secrecy hides unfair gaps between people doing the same work.",
            "Knowing what others earn helps people negotiate fairly.",
            "Openness puts pressure on employers to justify pay decisions.",
        ],
        "against": [
            "Salary is personal information many people want kept private.",
            "It could cause resentment and conflict between colleagues.",
            "Pay reflects things that are hard to see from outside, like experience and negotiation.",
        ],
    },
    {
        "id": "retire-70", "slug": "the-retirement-age-should-rise-to-70", "tag": "Money & Work",
        "motion": "The retirement age should rise to 70",
        "summary": "People are living longer, and pension systems are under strain. Raising the retirement age is one option governments are considering.",
        "for": [
            "People live much longer than when pension ages were set, so the system must adapt.",
            "Without changes, younger workers will pay ever higher taxes to fund pensions.",
            "Many people are healthy and productive well into their late 60s.",
        ],
        "against": [
            "People in physically demanding jobs often can't work that long.",
            "Life expectancy varies widely between rich and poor areas.",
            "It breaks a promise made to people who planned their lives around the current age.",
        ],
    },
    # --- Politics ---
    {
        "id": "compulsory-voting", "slug": "voting-should-be-compulsory", "tag": "Politics",
        "motion": "Voting should be compulsory",
        "summary": "Australia and some other countries fine people who don't vote, and turnout there is very high. Elsewhere, voting is seen as a right that includes the right not to.",
        "for": [
            "Governments would be chosen by almost everyone, not just the most motivated.",
            "Politicians would have to appeal to all voters, not just loyal ones.",
            "It works in countries that already do it, with very high turnout.",
        ],
        "against": [
            "Forcing people to vote goes against the idea of a free choice.",
            "People who don't follow politics may vote randomly.",
            "Parties should have to earn turnout by inspiring people.",
        ],
    },
    {
        "id": "rent-control", "slug": "rent-controls-would-fix-the-housing-crisis", "tag": "Politics",
        "motion": "Rent controls would fix the housing crisis",
        "summary": "Rents in many cities have soared faster than wages. Rent controls cap increases, but economists disagree about the side effects.",
        "for": [
            "Tenants get stability and protection from sudden huge rises.",
            "It stops long-term residents being priced out of their neighbourhoods.",
            "Housing is a basic need, not just an investment.",
        ],
        "against": [
            "Many economists say controls reduce the supply of rental homes over time.",
            "Landlords may stop maintaining properties if rents are capped.",
            "The real fix is building far more homes.",
        ],
    },
    {
        "id": "inheritance-tax", "slug": "inheritance-tax-should-be-much-higher", "tag": "Politics",
        "motion": "Inheritance tax should be much higher",
        "summary": "Inherited wealth plays a growing role in who owns homes and assets. Inheritance tax is one of the most unpopular taxes, even among people who'll never pay it.",
        "for": [
            "Inherited wealth isn't earned by the person who receives it.",
            "Large inheritances entrench inequality from one generation to the next.",
            "Taxing inheritance could allow lower taxes on work.",
        ],
        "against": [
            "The money was already taxed when it was earned.",
            "Parents should be free to pass on what they built to their children.",
            "The very rich use trusts to avoid it, so the middle class pays most.",
        ],
    },
    {
        "id": "gambling-ads", "slug": "gambling-adverts-should-be-banned", "tag": "Politics",
        "motion": "Gambling adverts should be banned",
        "summary": "Betting adverts are everywhere around sport, on shirts, pitch-side and online. Campaigners compare them to tobacco advertising.",
        "for": [
            "Gambling addiction destroys finances, families and lives.",
            "Adverts target young men around live sport, when impulses are high.",
            "Tobacco advertising was banned for similar reasons, and smoking fell.",
        ],
        "against": [
            "Adults should be free to choose how to spend their money.",
            "Many sports clubs and leagues rely on betting sponsorship.",
            "A ban could push people towards unregulated offshore sites.",
        ],
    },
    {
        "id": "sugar-tax", "slug": "sugar-should-be-taxed-like-alcohol", "tag": "Politics",
        "motion": "Sugar should be taxed like alcohol",
        "summary": "Several countries tax sugary drinks, and some manufacturers cut sugar in response. Extending taxes to more foods is hotly debated.",
        "for": [
            "Sugar drives obesity, diabetes and tooth decay that cost health systems a fortune.",
            "Sugary drink taxes led companies to reformulate products with less sugar.",
            "The money raised could fund healthier school meals and sport.",
        ],
        "against": [
            "Food taxes hit poorer families hardest.",
            "Adults should decide what they eat without the state making it pricier.",
            "Obesity has many causes; taxing one ingredient won't fix it.",
        ],
    },
    {
        "id": "student-loans", "slug": "student-loans-should-be-written-off", "tag": "Politics",
        "motion": "Student loans should be written off",
        "summary": "Graduates in many countries owe huge sums, and much of it will never be repaid. Cancelling it is popular with young people and controversial with everyone else.",
        "for": [
            "Young people were encouraged to borrow at 18 for a system that changed around them.",
            "Debt delays home ownership, families and starting businesses.",
            "Much of it will never be repaid anyway, so the cost is partly already accepted.",
        ],
        "against": [
            "It's unfair on people who didn't go to university or already repaid.",
            "Taxpayers, including non-graduates, would foot the bill.",
            "It doesn't fix the high cost of university for future students.",
        ],
    },
    {
        "id": "nuclear-power", "slug": "nuclear-power-is-the-answer-to-climate-change", "tag": "Science",
        "motion": "Nuclear power is the answer to climate change",
        "summary": "Nuclear power produces very low-carbon electricity around the clock. Critics point to cost, construction delays and waste.",
        "for": [
            "It provides steady, low-carbon power whatever the weather.",
            "It needs far less land than wind or solar for the same output.",
            "Modern reactor designs have strong safety records.",
        ],
        "against": [
            "New plants often take more than a decade to build and run over budget.",
            "Wind and solar have become much cheaper and faster to deploy.",
            "Long-term storage of radioactive waste is still politically unresolved.",
        ],
    },
    {
        "id": "lab-meat", "slug": "lab-grown-meat-is-the-future", "tag": "Science",
        "motion": "Lab-grown meat is the future",
        "summary": "Meat can now be grown from animal cells without raising and slaughtering animals. A few countries have approved it; others have tried to ban it.",
        "for": [
            "It could provide meat without animal suffering.",
            "It could use far less land and water than livestock farming.",
            "It gives meat lovers an option without asking them to change their diet.",
        ],
        "against": [
            "It remains expensive and hard to produce at large scale.",
            "Many consumers don't trust food made in a lab.",
            "It threatens farming communities and traditional food cultures.",
        ],
    },
    {
        "id": "flying-limits", "slug": "frequent-flyers-should-pay-more-tax", "tag": "Science",
        "motion": "Frequent flyers should pay more tax",
        "summary": "A small share of people take most flights. A frequent-flyer levy would tax each extra flight more heavily to cut emissions.",
        "for": [
            "Most flights are taken by a minority, so they should pay for the emissions.",
            "It protects the occasional family holiday while discouraging excessive flying.",
            "The money could fund cleaner transport like trains.",
        ],
        "against": [
            "Some people fly often for work or to see family abroad.",
            "Airlines would find ways around it or pass costs on to everyone.",
            "Investment in cleaner planes and fuels would do more.",
        ],
    },
    {
        "id": "plastic-ban", "slug": "single-use-plastic-should-be-banned", "tag": "Science",
        "motion": "Single-use plastic should be banned",
        "summary": "Plastic waste is found in oceans, wildlife and even human blood. Many countries have banned items like straws and bags; others want to go further.",
        "for": [
            "Single-use plastic pollutes oceans and harms wildlife for centuries.",
            "Bans on bags and straws show people adapt quickly.",
            "Only a small share of plastic is ever recycled.",
        ],
        "against": [
            "Plastic keeps food fresh and medical equipment sterile.",
            "Some alternatives, like paper or glass, can have higher carbon footprints.",
            "Disabled people rely on some single-use items like bendy straws.",
        ],
    },
    {
        "id": "fast-fashion", "slug": "fast-fashion-should-be-taxed", "tag": "Science",
        "motion": "Fast fashion should be taxed",
        "summary": "Ultra-cheap clothing brands release thousands of new items a week. Critics point to waste and working conditions; fans point to affordability.",
        "for": [
            "Cheap clothes are worn a few times then thrown away, creating huge waste.",
            "Low prices often depend on poor pay and conditions for garment workers.",
            "A tax would push brands to make clothes that last.",
        ],
        "against": [
            "Affordable clothing matters to people on low incomes.",
            "Defining 'fast fashion' fairly for a tax would be difficult.",
            "Consumer choice and better recycling are better solutions.",
        ],
    },
    # --- Sports ---
    {
        "id": "esports", "slug": "esports-are-real-sports", "tag": "Sports",
        "motion": "Esports are real sports",
        "summary": "Professional gaming fills arenas and pays millions in prize money. Whether it belongs alongside football and athletics is still argued.",
        "for": [
            "Top players need elite reflexes, strategy and teamwork, trained for hours a day.",
            "Esports have leagues, teams, coaches, fans and sponsors like any sport.",
            "Sports like chess and darts already count without demanding physical fitness.",
        ],
        "against": [
            "Sport traditionally means physical exertion, which gaming largely lacks.",
            "Games are owned by companies that can change or shut them down.",
            "Calling everything a sport makes the word meaningless.",
        ],
    },
    {
        "id": "var", "slug": "var-has-ruined-football", "tag": "Sports",
        "motion": "VAR has ruined football",
        "summary": "Video replays were meant to end obvious refereeing mistakes. Many fans now say the delays and marginal calls have spoiled the game.",
        "for": [
            "Long checks kill the moment of celebrating a goal.",
            "Offside decisions by a few centimetres feel absurd rather than fair.",
            "Decisions are still inconsistent, despite all the technology.",
        ],
        "against": [
            "VAR has corrected many clear errors that used to decide matches.",
            "Players are less able to get away with diving and hidden fouls.",
            "The problems are in how it's used, which can be fixed, not in the idea itself.",
        ],
    },
    {
        "id": "footballer-pay", "slug": "footballers-are-paid-too-much", "tag": "Sports",
        "motion": "Footballers are paid too much",
        "summary": "Top footballers can earn hundreds of thousands a week while nurses and teachers struggle. Others argue players are simply paid from the money they generate.",
        "for": [
            "Weekly wages higher than most people's yearly income are hard to justify.",
            "Ticket prices and TV subscriptions keep rising to fund those wages.",
            "Lower-league players and women's football get a tiny share.",
        ],
        "against": [
            "Players generate the revenue; if they earned less, owners would keep it.",
            "Careers are short and can end with one injury.",
            "Only a tiny fraction of hopefuls ever reach the top.",
        ],
    },
    # --- Relationships & Life ---
    {
        "id": "split-bill", "slug": "you-should-always-split-the-bill-on-a-first-date", "tag": "Relationships",
        "motion": "You should always split the bill on a first date",
        "summary": "Who pays on a first date can be awkward. Some see splitting as fair and modern; others see paying as a kind gesture.",
        "for": [
            "Splitting is equal and avoids anyone feeling they owe something.",
            "It removes outdated assumptions about who should pay.",
            "It keeps things relaxed, especially if the date doesn't go well.",
        ],
        "against": [
            "Offering to pay is a generous gesture that shows interest.",
            "Whoever suggested the date should cover it.",
            "Insisting on splitting can feel transactional on a first meeting.",
        ],
    },
    {
        "id": "phone-passwords", "slug": "couples-should-share-phone-passwords", "tag": "Relationships",
        "motion": "Couples should share phone passwords",
        "summary": "Some couples see open phones as a sign of trust. Others see a right to privacy, even in a relationship.",
        "for": [
            "If there's nothing to hide, sharing shows openness and trust.",
            "It's practical in emergencies or when one partner needs to use the other's phone.",
            "Secrecy can feed suspicion and arguments.",
        ],
        "against": [
            "Everyone deserves some privacy, even from a partner.",
            "Phones contain friends' private messages, not just your own.",
            "Demanding access is a form of control, not trust.",
        ],
    },
    {
        "id": "texting-instantly", "slug": "replying-instantly-to-texts-is-a-good-thing", "tag": "Relationships",
        "motion": "Replying instantly to texts is a good thing",
        "summary": "Some people answer within seconds; others reply days later. Reply speed has become its own unspoken language.",
        "for": [
            "Quick replies show respect and interest in the other person.",
            "They keep conversations flowing instead of dragging on for days.",
            "Playing games with reply times is childish.",
        ],
        "against": [
            "Nobody should be expected to be available all the time.",
            "Thoughtful replies are better than instant ones.",
            "Constant availability creates pressure and anxiety for everyone.",
        ],
    },
    {
        "id": "friends-politics", "slug": "you-can-be-friends-with-someone-whose-politics-you-hate", "tag": "Relationships",
        "motion": "You can be close friends with someone whose politics you hate",
        "summary": "Political divides increasingly split friendships and families. Some say politics reveals values; others say people are more than their votes.",
        "for": [
            "People are more than their political views: friendship rests on shared history and kindness.",
            "Friends who disagree keep each other from living in an echo chamber.",
            "Cutting off everyone you disagree with makes society more divided.",
        ],
        "against": [
            "Politics often reflects core values, like how people should be treated.",
            "Some views directly harm friends or their communities.",
            "Avoiding the topic forever makes a friendship shallow.",
        ],
    },
    {
        "id": "no-kids-planet", "slug": "choosing-not-to-have-children-is-better-for-the-planet", "tag": "Relationships",
        "motion": "Choosing not to have children is better for the planet",
        "summary": "Some people say they won't have children because of climate change. Others call that argument misguided or bleak.",
        "for": [
            "Each additional person adds a lifetime of consumption and emissions.",
            "It's reasonable to worry about bringing children into a world facing climate change.",
            "There are other ways to care for children, like adoption or fostering.",
        ],
        "against": [
            "Many countries face ageing populations and too few young workers.",
            "Children grow up to be the scientists and citizens who solve problems.",
            "Personal family choices shouldn't carry the blame for systemic emissions.",
        ],
    },
    {
        "id": "therapy-everyone", "slug": "everyone-should-go-to-therapy", "tag": "Relationships",
        "motion": "Everyone should go to therapy",
        "summary": "Talking about therapy has become far more normal. Some argue everyone benefits; others say it's not for everyone and is often unaffordable.",
        "for": [
            "Most people carry stresses or patterns they'd benefit from understanding.",
            "Therapy helps before problems become crises, not just after.",
            "Making it normal for everyone removes the stigma for those who need it most.",
        ],
        "against": [
            "Therapy is expensive and waiting lists are long; it should go to those most in need.",
            "Friends, family and community support people in other valuable ways.",
            "Not every difficulty needs professional treatment.",
        ],
    },
    # --- Movies & TV / Culture ---
    {
        "id": "video-games-art", "slug": "video-games-are-art", "tag": "Movies & TV",
        "motion": "Video games are art",
        "summary": "Games combine writing, music, visual design and interaction. Critics have argued for years over whether they belong in the same category as film and literature.",
        "for": [
            "Games bring together writing, music, acting and visual art.",
            "Many games tell stories and evoke emotions as powerfully as films or books.",
            "Museums now collect and exhibit games.",
        ],
        "against": [
            "Most games are designed primarily as commercial products for entertainment.",
            "Player control means there's no single authored work in the traditional sense.",
            "Calling everything art dilutes the word's meaning.",
        ],
    },
    {
        "id": "reality-tv", "slug": "reality-tv-does-more-harm-than-good", "tag": "Movies & TV",
        "motion": "Reality TV does more harm than good",
        "summary": "Reality shows draw huge audiences and launch careers. They have also faced criticism over contestants' mental health and staged drama.",
        "for": [
            "Contestants have been put under intense pressure, sometimes with serious consequences.",
            "Shows often edit people unfairly to create villains.",
            "It promotes unrealistic bodies, lifestyles and relationships.",
        ],
        "against": [
            "Viewers know it's entertainment and enjoy it as such.",
            "Some shows build empathy by showing people from different backgrounds.",
            "Broadcasters have improved aftercare and support for contestants.",
        ],
    },
    {
        "id": "streaming-tv", "slug": "streaming-has-made-tv-worse", "tag": "Movies & TV",
        "motion": "Streaming has made TV worse",
        "summary": "Streaming services brought huge budgets and choice. Viewers now complain about cancellations, endless subscriptions and shows designed to be half-watched.",
        "for": [
            "Good shows are cancelled after one season before they find an audience.",
            "Content is spread across so many services that it costs more than cable did.",
            "Some shows are made to be background noise while people scroll their phones.",
        ],
        "against": [
            "There's more high-quality TV available than ever before.",
            "Streaming gave a platform to stories and creators that traditional TV ignored.",
            "You can watch what you want, when you want, without adverts.",
        ],
    },
    # --- Unhinged ---
    {
        "id": "toilet-roll", "slug": "toilet-roll-should-hang-over-not-under", "tag": "Unhinged",
        "motion": "Toilet roll should hang over, not under",
        "summary": "Over or under? The original patent drawing shows over, but households everywhere remain divided.",
        "for": [
            "The original 1891 patent drawing shows the paper hanging over the front.",
            "It's easier to find the end and tear off a sheet.",
            "Your hand touches only the paper you're using, not the wall.",
        ],
        "against": [
            "Under is tidier and hides the loose end.",
            "Cats and toddlers can't unroll it as easily.",
            "It's the household's choice, and 'over' people need to relax.",
        ],
    },
    {
        "id": "shower-night", "slug": "showering-at-night-is-better-than-morning", "tag": "Unhinged",
        "motion": "Showering at night is better than in the morning",
        "summary": "Some people can't start the day without a shower. Others refuse to get into bed without one.",
        "for": [
            "You go to bed clean instead of bringing the day's dirt into your sheets.",
            "A warm shower helps you relax and fall asleep.",
            "Mornings are less rushed.",
        ],
        "against": [
            "A morning shower wakes you up properly.",
            "You start the day fresh instead of with bed hair and night sweat.",
            "It's the one moment of peace before the day starts.",
        ],
    },
    {
        "id": "cereal-first", "slug": "cereal-goes-in-before-the-milk", "tag": "Unhinged",
        "motion": "Cereal goes in before the milk",
        "summary": "A breakfast question that seems obvious until you meet someone who does it the other way.",
        "for": [
            "You can see how much cereal you're having before adding milk.",
            "Pouring milk on top keeps the cereal crunchy for longer.",
            "It's how the packet photos and adverts do it.",
        ],
        "against": [
            "Milk first means no splashing over the edge of the bowl.",
            "You control exactly how much milk there is.",
            "It's the only reliable way to get the milk-to-cereal ratio right.",
        ],
    },
    {
        "id": "early-late", "slug": "arriving-early-is-as-rude-as-arriving-late", "tag": "Unhinged",
        "motion": "Arriving early is as rude as arriving late",
        "summary": "Everyone agrees lateness is annoying. Fewer people talk about the guest who rings the doorbell 20 minutes before the party starts.",
        "for": [
            "Hosts use the last minutes to get ready, and early guests take that away.",
            "It makes the host feel they have to entertain before they're ready.",
            "On time means on time, not whenever suits you.",
        ],
        "against": [
            "Being early shows respect for someone's time.",
            "Early guests can help with last-minute preparations.",
            "Lateness wastes people's time; earliness at worst means a bit of small talk.",
        ],
    },
    {
        "id": "recline-seat", "slug": "reclining-your-seat-on-a-plane-is-fine", "tag": "Unhinged",
        "motion": "Reclining your plane seat is fine",
        "summary": "The seat reclines, so you should be allowed to. Unless you're the person behind.",
        "for": [
            "The seat is designed to recline, and you paid for that seat.",
            "On long flights, reclining is the only way to rest.",
            "The person behind can recline too.",
        ],
        "against": [
            "It takes space from someone who can't escape it.",
            "On short flights, there's no real need.",
            "Basic courtesy means checking with the person behind first.",
        ],
    },
    {
        "id": "voice-notes", "slug": "long-voice-notes-should-be-banned", "tag": "Unhinged",
        "motion": "Voice notes over a minute should be banned",
        "summary": "Some people love voice notes. Others dread receiving a four-minute recording that could have been one sentence.",
        "for": [
            "Text can be skimmed in seconds; a voice note makes you listen to every word.",
            "You can't listen in a quiet office or on a busy train.",
            "Finding one detail later means listening to the whole thing again.",
        ],
        "against": [
            "Voice carries tone and warmth that text can't.",
            "It's quicker and easier for the sender, especially on the move.",
            "Hearing a friend's voice feels more personal.",
        ],
    },
]
