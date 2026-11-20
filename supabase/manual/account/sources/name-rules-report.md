# Set 03 name-rule review

Generated deterministically from local files. SQL remains authoritative. Tables below run the shared TypeScript contract matcher; PostgreSQL execution is deferred to the owner's PostgreSQL 17.6 mock and 03-verify.sql.

## Inputs and policy

- `dsojevic-profanity-en.json`: SHA-256 `bcf8bfc09dd3f7480972cb041a4cba291a6ff16a6fbf29022d5d679e3c39502c`
- `dsojevic-profanity-src-en.json`: SHA-256 `c6335736d52678a33c7c58cfd25cd03cf78119d6717cacca0c7b442c3645836f`
- `btrsco-reserved-usernames.json`: SHA-256 `278f5da24930e867f17e412c0ebb3f6c07feafa92398fe8180b44ea550dfd8dc`

Built fields win; missing per-entry metadata is supplemented by ID from the grouped src file, with repeated IDs disambiguated by match/severity/tags. Severity 3–4 contains unless allow_partial=false; severity 1–2 exact. Source exceptions mask contains rules only. No owner exception is seeded.

## Counts

| Policy | Distinct rows |
| --- | ---: |
| contains | 520 |
| exact | 107 |
| reserved | 469 |

Entry counts are before expansion/deduplication. Rule counts count distinct banned rows carrying that severity/tag; multi-attributed rows can appear in more than one category.

| Severity | Entries | Seeded rules |
| --- | ---: | ---: |
| 1 | 28 | 34 |
| 2 | 44 | 70 |
| 3 | 331 | 470 |
| 4 | 31 | 54 |

| Tag | Entries | Seeded rules |
| --- | ---: | ---: |
| general | 34 | 53 |
| lgbtq | 74 | 92 |
| racial | 48 | 83 |
| religious | 7 | 9 |
| sexual | 262 | 376 |
| shock | 9 | 16 |

## Must-pass innocent names

PASS means available; a reservation is reported separately from moderation. No exceptions have been added to improve these results.

| Name | Actual outcome | Review | Matching ban |
| --- | --- | --- | --- |
| Cassandra | available | PASS |  |
| Glassy | available | PASS |  |
| Bassist | available | PASS |  |
| Scunthorpe | available | PASS |  |
| Essex | available | PASS |  |
| Dickens | available | PASS |  |
| Grape | available | PASS |  |
| Therapist | banned | FAIL — owner review | `rapist` |
| Assassin | available | PASS |  |
| Classic | available | PASS |  |
| Matsushita | available | PASS |  |
| Hancock | available | PASS |  |
| Cockpit | available | PASS |  |
| Shuttlecock | available | PASS |  |
| Penistone | available | PASS |  |
| Sussex | available | PASS |  |
| Pushkin | available | PASS |  |
| Analyst | available | PASS |  |
| Titanic | available | PASS |  |
| Butterfly | available | PASS |  |
| Peacock | available | PASS |  |
| Skunk | available | PASS |  |
| Sextant | available | PASS |  |
| Document | reserved | FAIL — owner review |  |
| Pilot1 | available | PASS |  |
| StarVoyager | available | PASS |  |
| Raccoon | available | PASS |  |
| Twinkling | available | PASS |  |
| Sparsefox | available | PASS |  |

## Must-fail abuse examples

| Name | Actual outcome | Result |
| --- | --- | --- |
| Fuck | banned | PASS |
| Fuuuuck | banned | PASS |
| MyFuckingShip | banned | PASS |
| N1gg3r | banned | PASS |
| Sh1t | banned | PASS |
| S3x | banned | PASS |
| R4pe | banned | PASS |
| CuM | banned | PASS |
| Blowjob | banned | PASS |
| BallKicking | banned | PASS |
| B4dw0rd | banned | PASS — synthetic badword rule only; not a production seed |

## Proposed owner review

- Proposed exact decoded owner exception `therapist` for Therapist; not inserted.
- Document is reserved, not banned. An exception cannot release it; Judd must separately approve releasing reservation `document`.

## All reserved names

Compact alphabetical listing for owner review:

**A:** `about`, `abuse`, `access`, `account`, `accounts`, `add`, `address`, `adm`, `admin`, `administration`, `administrator`, `admins`, `ads`, `adult`, `advertising`, `affiliate`, `affiliates`, `ajax`, `alias`, `analytics`, `android`, `anon`, `anonymous`, `apache`, `apache2`, `api`, `app`, `appowner`, `apps`, `appserver`, `archive`, `assets`, `asterisk`, `atom`, `auth`, `authentication`, `automount`, `avatar`

**B:** `backup`, `banner`, `banners`, `bash`, `beta`, `billing`, `bin`, `blog`, `blogs`, `board`, `boarding`, `bot`, `bots`, `business`

**C:** `cache`, `cadastro`, `calendar`, `campaign`, `card`, `careers`, `categories`, `category`, `cgi`, `changelog`, `changeme`, `chat`, `claim`, `client`, `clients`, `code`, `comercial`, `comment`, `comments`, `compare`, `compras`, `computer`, `config`, `connect`, `console`, `contact`, `content`, `cores`, `cpanel`, `create`, `creator`, `creators`, `css`, `curl`, `customer`, `customers`

**D:** `daemon`, `dashboard`, `data`, `database`, `delete`, `demo`, `deploy`, `design`, `designer`, `dev`, `devel`, `develop`, `developer`, `dir`, `directory`, `discover`, `doc`, `docs`, `document`, `documents`, `domain`, `download`, `downloads`

**E:** `ecom`, `ecommerce`, `edit`, `editor`, `email`, `etc`, `exec`, `exit`

**F:** `faq`, `fav`, `favicon`, `favorite`, `fax`, `feed`, `feedback`, `file`, `files`, `firewall`, `flog`, `follow`, `forum`, `forums`, `free`, `ftp`, `ftpadmin`, `ftpguest`, `ftptest`, `ftpuser`, `ftpusr`

**G:** `gadget`, `gadgets`, `games`, `git`, `goto`, `group`, `groups`, `guest`

**H:** `help`, `helpdesk`, `hidden`, `home`, `homepage`, `host`, `hostadmin`, `hosting`, `hostmaster`, `hostname`, `hostserver`, `htaccess`, `html`, `htpasswd`, `http`, `httpd`, `https`

**I:** `image`, `images`, `imap`, `img`, `index`, `indice`, `info`, `install`, `internet`, `intranet`, `invite`, `ipad`, `iphone`, `irc`

**J:** `java`, `javascript`, `job`, `jobs`

**K:** `kernal`, `kkk`, `knowledgebase`

**L:** `lib`, `libexec`, `library`, `like`, `likes`, `link`, `links`, `linux`, `list`, `lists`, `local`, `localhost`, `log`, `login`, `logout`, `logs`

**M:** `mach`, `mail`, `mail1`, `mail2`, `mail3`, `mail4`, `mail5`, `mailer`, `mailexchange`, `mailing`, `mailman`, `mailtest`, `manager`, `marketing`, `master`, `media`, `message`, `messages`, `messenger`, `microblog`, `microblogs`, `mine`, `mob`, `mobile`, `mod`, `moderator`, `moodle`, `movie`, `movies`, `mp3`, `msg`, `msn`, `music`, `musicas`, `mysql`

**N:** `nagios`, `name`, `named`, `net`, `network`, `new`, `news`, `newsletter`, `nginx`, `nickname`, `noc`, `notes`, `noticias`, `ns0`, `ns1`, `ns2`, `ns3`, `ns4`, `null`

**O:** `office`, `official`, `old`, `onboarding`, `online`, `operator`, `oracle`, `order`, `orders`, `org`, `owner`

**P:** `page`, `pager`, `pages`, `panel`, `passphrase`, `passwd`, `password`, `perl`, `pgsql`, `photo`, `photoalbum`, `photos`, `php`, `pic`, `pics`, `plugin`, `plugins`, `pop`, `pop3`, `post`, `postadmin`, `postfix`, `postmaster`, `posts`, `preferences`, `privacy`, `privacypolicy`, `private`, `prod`, `production`, `profile`, `project`, `projects`, `promo`, `proxy`, `pub`, `public`, `python`

**Q:** `qwerty`

**R:** `random`, `register`, `registration`, `restart`, `robots`, `root`, `rss`, `ruby`

**S:** `sale`, `sales`, `sample`, `samples`, `sass`, `sbin`, `script`, `scripts`, `scss`, `search`, `secure`, `security`, `send`, `server`, `serveradmin`, `serverhost`, `service`, `setting`, `settings`, `setup`, `shapeship`, `shapeships`, `shell`, `shop`, `shutdown`, `signin`, `signout`, `signup`, `site`, `sitemap`, `siteowner`, `sites`, `smtp`, `spam`, `sql`, `ssh`, `sshd`, `staff`, `staffadmin`, `staffmanager`, `staffmember`, `stage`, `staging`, `standalone`, `start`, `stat`, `static`, `stats`, `status`, `store`, `stores`, `student`, `students`, `subdomain`, `submit`, `submitted`, `subscribe`, `sudo`, `super`, `superuser`, `suporte`, `support`, `sybase`, `sync`, `sys`, `sysadmin`, `system`, `systemadmin`

**T:** `tablet`, `tablets`, `talk`, `task`, `tasks`, `tech`, `telnet`, `telnetd`, `temp`, `temporary`, `terms`, `termsofservice`, `test`, `test1`, `test123`, `test2`, `test3`, `teste`, `tester`, `testftp`, `testing`, `tests`, `testuser`, `theme`, `themes`, `tmp`, `todo`, `tools`, `tos`, `trash`

**U:** `ubuntu`, `unix`, `unknown`, `update`, `upload`, `url`, `usage`, `usenet`, `user`, `useradmin`, `userftp`, `username`, `usertest`, `usr`, `usuario`, `uucp`

**V:** `var`, `video`, `videos`, `visitor`, `vmail`, `vol`, `volumes`, `vvv`

**W:** `web`, `webadmin`, `webmail`, `webmaster`, `webmin`, `website`, `websites`, `webuser`, `welcome`, `win`, `workshop`, `wws`, `www`, `www1`, `www2`, `www3`, `www4`, `www5`, `www6`, `www7`, `wwwrun`, `wwws`, `wwww`

**X:** `xhtml`, `xml`, `xpg`, `xxx`

**Y:** `you`, `yourdomain`, `yourname`, `yoursite`, `yourusername`

**Z:** `zsh`

## Dropped Snapchat-specific block

`_appspecific`, `danklens`, `danklenses`, `disclaimer`, `lens`, `lensadmin`, `lensarchive`, `lenscodes`, `lenscodesadmin`, `lenses`, `snap`, `snapcata`, `snapchat`, `snapchatlens`, `snapchatlenses`, `snapinc`, `snaplens`, `snaplenses`, `spectacles`, `unlock`, `usersub`, `virallenses`

## Every rewrite, exception conversion and drop

- REWRITE 1man1jar: 1m1j → imij
- REWRITE 1man1jar: 1man1jar → imanijar
- REWRITE 1man1jar: 1 man 1 jar → imanijar
- REWRITE 1man1jar: one man one jar → onemanonejar
- REWRITE 1man1jar: one jar one man → onejaroneman
- REWRITE 2girls1cup: 2g1c → zgic
- REWRITE 2girls1cup: 2girls1cup → zgirlsicup
- REWRITE 2girls1cup: 2 girls 1 cup → zgirlsicup
- REWRITE 2girls1cup: two girls one cup → twogirlsonecup
- REWRITE 2girls1cup: one cup two girls → onecuptwogirls
- REWRITE adjective-cock: black cock → blackcock
- REWRITE adjective-cock: big cock → bigcock
- REWRITE adjective-cock: huge cock → hugecock
- REWRITE adjective-cock: giant cock → giantcock
- REWRITE adjective-cock: massive cock → massivecock
- REWRITE adjective-cock: throbbing cock → throbbingcock
- REWRITE alabama-hot-pocket: alabama hot pocket → alabamahotpocket
- REWRITE alabama-tuna-melt: alabama tuna melt → alabamatunamelt
- REWRITE alaskan-pipeline: alaskan pipeline → alaskanpipeline
- REWRITE anal-assassin: anal assassin → analassassin
- REWRITE anal-astronaut: anal astronaut → analastronaut
- REWRITE apeshit: ape-shit → apeshit
- REWRITE apeshit: ape shit → apeshit
- REWRITE ass-bandit: ass bandit → assbandit
- REWRITE ass-bandit: arse bandit → arsebandit
- REWRITE autoerotic\|auto erotic: auto erotic → autoerotic
- REWRITE baby-batter: baby batter → babybatter
- REWRITE baby-batter: baby gravy → babygravy
- REWRITE baby-batter: baby juice → babyjuice
- REWRITE baby-batter: ball batter → ballbatter
- REWRITE baby-batter: ball gravy → ballgravy
- REWRITE ball-gag: ball gag → ballgag
- REWRITE ball-gag: ball-gag → ballgag
- REWRITE ball-kicking: ball kicking → ballkicking
- REWRITE ball-kicking: ball-kicking → ballkicking
- REWRITE ball-licking: ball licking → balllicking
- REWRITE ball-licking: ball-licking → balllicking
- REWRITE ball-sack: ball sack → ballsack
- REWRITE ball-sucking: ball sucking → ballsucking
- REWRITE ball-sucking: ball-sucking → ballsucking
- REWRITE bangbros: bang bros → bangbros
- REWRITE bangbus: bang bus → bangbus
- REWRITE barely-legal: barely legal → barelylegal
- REWRITE batty-boy: batty boy → battyboy
- REWRITE batty-boy: batty boi → battyboi
- REWRITE bean-flicker: bean flicker → beanflicker
- REWRITE bean-flicker: bean-flicker → beanflicker
- REWRITE bean-queen: bean queen → beanqueen
- EXCEPTION beaner: *ies → beaneries
- EXCEPTION beaner: *y → beanery
- EXCEPTION beaner: *ies → beanersies
- EXCEPTION beaner: *y → beanersy
- REWRITE beaver-cleaver: beaver cleaver → beavercleaver
- REWRITE beaver-lips: beaver lips → beaverlips
- EXCEPTION bellend: *en → bellenden
- EXCEPTION bicon: *cave → biconcave
- EXCEPTION bicon: *cavities → biconcavities
- EXCEPTION bicon: *cavity → biconcavity
- EXCEPTION bicon: *vex → biconvex
- EXCEPTION bicon: *vexities → biconvexities
- EXCEPTION bicon: *vexity → biconvexity
- REWRITE big-boobs: big boobs → bigboobs
- REWRITE big-boobs: big breasts → bigbreasts
- REWRITE big-boobs: big knockers → bigknockers
- REWRITE big-boobs: big tits → bigtits
- REWRITE blow-your-load: blow your load → blowyourload
- REWRITE blowjob: blow-job → blowjob
- REWRITE blowjob: blow job → blowjob
- REWRITE blue-waffle: blue waffle → bluewaffle
- REWRITE bone-smuggler: bone smuggler → bonesmuggler
- REWRITE bone-smuggler: bone-smuggler → bonesmuggler
- REWRITE boner: raging boner → ragingboner
- REWRITE boner: throbbing boner → throbbingboner
- REWRITE booty-buffer: booty buffer → bootybuffer
- REWRITE booty-buffer: booty-buffer → bootybuffer
- REWRITE booty-call: booty call → bootycall
- REWRITE boston-george: boston george → bostongeorge
- REWRITE brown-piper: brown piper → brownpiper
- REWRITE brown-piper: brown-piper → brownpiper
- REWRITE brown-shower: brown shower → brownshower
- REWRITE brown-shower: brown showers → brownshowers
- REWRITE brownie-royalty: brownie king → brownieking
- REWRITE brownie-royalty: brownie queen → browniequeen
- REWRITE buddhahead: buddha head → buddhahead
- REWRITE buddhahead: buddha-head → buddhahead
- REWRITE bullet-vibe: bullet vibe → bulletvibe
- REWRITE bullet-vibe: bullet vibrator → bulletvibrator
- REWRITE bullshit: bull-shit → bullshit
- REWRITE bullshit: bull shit → bullshit
- REWRITE bum-chum: bum chum → bumchum
- REWRITE bum-chum: bum-chum → bumchum
- REWRITE bum-driller: bum driller → bumdriller
- REWRITE bum-driller: bum-driller → bumdriller
- REWRITE butt-boy: butt boy → buttboy
- REWRITE butt-boy: butt-boy → buttboy
- REWRITE butt-boy: bum boy → bumboy
- REWRITE butt-boy: bum-boy → bumboy
- REWRITE butt-pilot: butt pilot → buttpilot
- REWRITE butt-pilot: bum pilot → bumpilot
- REWRITE butt-pirate: butt pirate → buttpirate
- REWRITE butt-pirate: butt-pirate → buttpirate
- REWRITE butt-pirate: bum pirate → bumpirate
- REWRITE butt-pirate: bum-pirate → bumpirate
- REWRITE butt-rider: butt rider → buttrider
- REWRITE butt-rider: bum rider → bumrider
- REWRITE butt-robber: butt robber → buttrobber
- REWRITE butt-robber: butt-robber → buttrobber
- REWRITE butt-robber: bum robber → bumrobber
- REWRITE butt-robber: bum-robber → bumrobber
- REWRITE butt-rustler: butt rustler → buttrustler
- REWRITE butt-rustler: bum rustler → bumrustler
- REWRITE butthole-engineer: butthole engineer → buttholeengineer
- REWRITE butthole-engineer: bumhole engineer → bumholeengineer
- REWRITE camel-jockey: camel jockey → cameljockey
- REWRITE camel-jockey: camel jockies → cameljockies
- REWRITE camel-toe: camel toe → cameltoe
- REWRITE canadian-porch-swing: canadian porch swing → canadianporchswing
- REWRITE carpet-muncher: carpet muncher → carpetmuncher
- DROP cheese-monkey: cheese-eating surrender monkey → cheeseeatingsurrendermonkey
- DROP cheese-monkey: cheese eating surrender monkey → cheeseeatingsurrendermonkey
- REWRITE chi-chi-man: chi chi man → chichiman
- REWRITE chi-chi-man: chi-chi man → chichiman
- REWRITE chicken-queen: chicken queen → chickenqueen
- REWRITE chinaman: china man → chinaman
- REWRITE chinaman: china men → chinamen
- REWRITE ching-chong: ching-chong → chingchong
- REWRITE ching-chong: ching chong → chingchong
- EXCEPTION chink: *apin → chinkapin
- EXCEPTION chink: *apins → chinkapins
- EXCEPTION chink: *ed → chinked
- EXCEPTION chink: *ier → chinkier
- EXCEPTION chink: *iest → chinkiest
- EXCEPTION chink: *ing → chinking
- EXCEPTION chink: pa*o → pachinko
- EXCEPTION chink: pa*os → pachinkos
- EXCEPTION chink: *apin → chinksapin
- EXCEPTION chink: *apins → chinksapins
- EXCEPTION chink: *ed → chinksed
- EXCEPTION chink: *ier → chinksier
- EXCEPTION chink: *iest → chinksiest
- EXCEPTION chink: *ing → chinksing
- EXCEPTION chink: pa*o → pachinkso
- EXCEPTION chink: pa*os → pachinksos
- EXCEPTION chink: *apin → chinkyapin
- EXCEPTION chink: *apins → chinkyapins
- EXCEPTION chink: *ed → chinkyed
- EXCEPTION chink: *ier → chinkyier
- EXCEPTION chink: *iest → chinkyiest
- EXCEPTION chink: *ing → chinkying
- EXCEPTION chink: pa*o → pachinkyo
- EXCEPTION chink: pa*os → pachinkyos
- REWRITE chocolate-rosebud: chocolate rosebud → chocolaterosebud
- REWRITE chocolate-rosebud: chocolate rosebuds → chocolaterosebuds
- REWRITE circlejerk: circle-jerk → circlejerk
- REWRITE cleveland-accordion: cleveland accordion → clevelandaccordion
- REWRITE cleveland-hot-waffle: cleveland hot waffle → clevelandhotwaffle
- REWRITE cleveland-steamer: cleveland steamer → clevelandsteamer
- EXCEPTION clit: *ella → clitella
- EXCEPTION clit: *ellum → clitellum
- EXCEPTION clit: *ic → clitic
- EXCEPTION clit: *icize → cliticize
- EXCEPTION clit: *icized → cliticized
- EXCEPTION clit: *icizes → cliticizes
- EXCEPTION clit: *icizing → cliticizing
- EXCEPTION clit: *ics → clitics
- EXCEPTION clit: ana*ic → anaclitic
- EXCEPTION clit: cy*ol → cyclitol
- EXCEPTION clit: cy*ols → cyclitols
- EXCEPTION clit: en*ic → enclitic
- EXCEPTION clit: en*ics → enclitics
- EXCEPTION clit: hetero*e → heteroclite
- EXCEPTION clit: hetero*es → heteroclites
- EXCEPTION clit: pa*axel → paclitaxel
- EXCEPTION clit: pa*axels → paclitaxels
- EXCEPTION clit: pro*ic → proclitic
- EXCEPTION clit: pro*ics → proclitics
- REWRITE clover-clamps: clover clamps → cloverclamps
- REWRITE clover-clamps: clover clamp → cloverclamp
- REWRITE clusterfuck: cluster-fuck → clusterfuck
- REWRITE clusterfuck: cluster fuck → clusterfuck
- REWRITE cockpipe-cosmonaut: cockpipe cosmonaut → cockpipecosmonaut
- REWRITE cockstruction-worker: cockstruction worker → cockstructionworker
- EXCEPTION coon: barra* → barracoon
- EXCEPTION coon: coc* → coccoon
- EXCEPTION coon: coc*ed → coccooned
- EXCEPTION coon: puc* → puccoon
- EXCEPTION coon: rac* → raccoon
- EXCEPTION coon: ty* → tycoon
- EXCEPTION coon: *tie → coontie
- EXCEPTION coon: * can → cooncan
- EXCEPTION coon: *can → cooncan
- EXCEPTION coon: * hound → coonhound
- EXCEPTION coon: *hound → coonhound
- EXCEPTION coon: * skin → coonskin
- EXCEPTION coon: *skin → coonskin
- EXCEPTION coon: barra* → barracoons
- EXCEPTION coon: coc* → coccoons
- EXCEPTION coon: coc*ed → coccoonsed
- EXCEPTION coon: puc* → puccoons
- EXCEPTION coon: rac* → raccoons
- EXCEPTION coon: ty* → tycoons
- EXCEPTION coon: *tie → coonstie
- EXCEPTION coon: * can → coonscan
- EXCEPTION coon: *can → coonscan
- EXCEPTION coon: * hound → coonshound
- EXCEPTION coon: *hound → coonshound
- EXCEPTION coon: * skin → coonsskin
- EXCEPTION coon: *skin → coonsskin
- REWRITE crafty-butcher: crafty butcher → craftybutcher
- REWRITE creampie: cream-pie → creampie
- REWRITE cumshot: cum shot → cumshot
- REWRITE cumshot: cum shots → cumshots
- EXCEPTION cunt: s*horpe → scunthorpe
- EXCEPTION cunt: s*horpe → skunthorpe
- EXCEPTION cunt: s*horpe → scuntshorpe
- EXCEPTION cunt: s*horpe → skuntshorpe
- REWRITE cuntboy: cunt-boy → cuntboy
- REWRITE cuntboy: cunt boy → cuntboy
- REWRITE curry-muncher: curry muncher → currymuncher
- REWRITE curry-muncher: curry-muncher → currymuncher
- REWRITE date-rape: date rape → daterape
- REWRITE deep-throat: deep throat → deepthroat
- REWRITE deep-throat: deep-throat → deepthroat
- REWRITE dickgirl: dick-girl → dickgirl
- REWRITE dickgirl: dick girl → dickgirl
- REWRITE dirty-pillows: dirty pillows → dirtypillows
- REWRITE dirty-sanchez: dirty sanchez → dirtysanchez
- REWRITE doggie-style: doggie style → doggiestyle
- REWRITE doggie-style: doggie-style → doggiestyle
- REWRITE doggie-style: doggy style → doggystyle
- REWRITE doggie-style: doggy-style → doggystyle
- REWRITE doggie-style: dog style → dogstyle
- REWRITE dogshit: dog-shit → dogshit
- REWRITE dogshit: dog shit → dogshit
- REWRITE donkey-punch: donkey punch → donkeypunch
- REWRITE donut-muncher: donut muncher → donutmuncher
- REWRITE donut-puncher: donut puncher → donutpuncher
- REWRITE double-penetration: double penetration → doublepenetration
- REWRITE double-penetration: dp action → dpaction
- REWRITE dry-hump: dry hump → dryhump
- REWRITE dune-coon: dune coon → dunecoon
- REWRITE dune-coon: dune-coon → dunecoon
- REWRITE dune-coon: doon coon → dooncoon
- REWRITE dutch-rudder: dutch rudder → dutchrudder
- EXCEPTION dyke: van* → vandyke
- EXCEPTION dyke: van*d → vandyked
- EXCEPTION dyke: van*s → vandykes
- REWRITE edgeplay: edge play → edgeplay
- REWRITE electro-play: electro-play → electroplay
- EXCEPTION enby: all* → allenby
- EXCEPTION enby: as* → asenby
- EXCEPTION enby: brook* → brookenby
- EXCEPTION enby: ca* → caenby
- EXCEPTION enby: d* → denby
- EXCEPTION enby: froz*te → frozenbyte
- EXCEPTION enby: gat* → gatenby
- EXCEPTION enby: hold* → holdenby
- EXCEPTION enby: lack* → lackenby
- EXCEPTION enby: laz* → lazenby
- EXCEPTION enby: nav* → navenby
- EXCEPTION enby: ott* → ottenby
- EXCEPTION enby: r*gda → renbygda
- EXCEPTION enby: t* → tenby
- EXCEPTION enby: warr* → warrenby
- EXCEPTION enby: wh* → whenby
- REWRITE eskimo-trebuchet: eskimo trebuchet → eskimotrebuchet
- REWRITE eyetie: eye-tie → eyetie
- EXCEPTION fag: lea*e → leafage
- EXCEPTION fag: lea*es → leafages
- EXCEPTION fag: ser*e → serfage
- EXCEPTION fag: ser*es → serfages
- EXCEPTION fag: whar*e → wharfage
- EXCEPTION fag: whar*es → wharfages
- REWRITE fag-bomb: fag bomb → fagbomb
- REWRITE fag-bomb: fag-bomb → fagbomb
- REWRITE female-squirting: female squirting → femalesquirting
- REWRITE fingerbang: finger bang → fingerbang
- REWRITE footjob: foot-job → footjob
- REWRITE footjob: foot job → footjob
- REWRITE french-rudder: french rudder → frenchrudder
- REWRITE frogeater: frog-eater → frogeater
- REWRITE frogeater: frog eater → frogeater
- REWRITE frolicme: frolic me → frolicme
- REWRITE fuckwit: fuck-wit → fuckwit
- REWRITE fudge-packer: fudge packer → fudgepacker
- REWRITE fudge-packer: fudge-packer → fudgepacker
- REWRITE g-spot: g-spot → gspot
- REWRITE gangbang: gang bang → gangbang
- REWRITE gay-sex: gay sex → gaysex
- REWRITE gin-jockey: gin jockey → ginjockey
- REWRITE gin-jockey: gin jocky → ginjocky
- REWRITE girl-on-top: girl on top → girlontop
- REWRITE god-damn: god damn → goddamn
- REWRITE god-damn: god-damn → goddamn
- REWRITE god-damn: god damned → goddamned
- REWRITE god-damn: god-damned → goddamned
- REWRITE gokkun: go-kun → gokun
- REWRITE golden-shower: golden shower → goldenshower
- REWRITE golden-shower: golden showers → goldenshowers
- REWRITE golden-shower: yellow shower → yellowshower
- REWRITE golden-shower: yellow showers → yellowshowers
- EXCEPTION gook: gobblede* → gobbledegook
- EXCEPTION gook: gobblede*s → gobbledegooks
- EXCEPTION gook: gobbledy* → gobbledygook
- EXCEPTION gook: gobbledy*s → gobbledygooks
- EXCEPTION gook: gobblede* → gobbledegooks
- EXCEPTION gook: gobblede*s → gobbledegookss
- EXCEPTION gook: gobbledy* → gobbledygooks
- EXCEPTION gook: gobbledy*s → gobbledygookss
- REWRITE gook: gook-eye → gookeye
- EXCEPTION gook: gobblede* → gobbledegookeye
- EXCEPTION gook: gobblede*s → gobbledegookeyes
- EXCEPTION gook: gobbledy* → gobbledygookeye
- EXCEPTION gook: gobbledy*s → gobbledygookeyes
- EXCEPTION gook: gobblede* → gobbledegooky
- EXCEPTION gook: gobblede*s → gobbledegookys
- EXCEPTION gook: gobbledy* → gobbledygooky
- EXCEPTION gook: gobbledy*s → gobbledygookys
- EXCEPTION gook: gobblede* → gobbledegookie
- EXCEPTION gook: gobblede*s → gobbledegookies
- EXCEPTION gook: gobbledy* → gobbledygookie
- EXCEPTION gook: gobbledy*s → gobbledygookies
- REWRITE grey-queen: grey queen → greyqueen
- REWRITE grey-queen: gray queen → grayqueen
- REWRITE group-sex: group sex → groupsex
- REWRITE gym-bunny: gym bunny → gymbunny
- REWRITE hand-job: hand job → handjob
- REWRITE hand-job: hand-job → handjob
- EXCEPTION hermie: diat*s → diathermies
- EXCEPTION hermie: endot*s → endothermies
- EXCEPTION hermie: homeot*s → homeothermies
- REWRITE hickory-switch: hickory switch → hickoryswitch
- REWRITE horseshit: horse-shit → horseshit
- REWRITE horseshit: horse shit → horseshit
- REWRITE hot-carl: hot carl → hotcarl
- REWRITE hot-richard: hot richard → hotrichard
- REWRITE impact-play: impact play → impactplay
- REWRITE impact-play: impact-play → impactplay
- REWRITE jack-off: jack off → jackoff
- REWRITE jack-off: jack-off → jackoff
- REWRITE jail-bait: jail bait → jailbait
- REWRITE jelly-donut: jelly donut → jellydonut
- REWRITE jerk-off: jerk off → jerkoff
- REWRITE jerk-off: jerk-off → jerkoff
- REWRITE jerkmate: jerk mate → jerkmate
- REWRITE jesus-christ: je*su*s chri*st → je*su*schri*st
- REWRITE jungle-bunny: jungle bunny → junglebunny
- DROP kennebunkport-surprise: kennebunkport surprise → kennebunkportsurprise
- REWRITE kentucky-klondike: kentucky klondike → kentuckyklondike
- DROP kentucky-tractor-puller: kentucky tractor puller → kentuckytractorpuller
- REWRITE kitty-puncher: kitty puncher → kittypuncher
- REWRITE kitty-puncher: kitty-puncher → kittypuncher
- REWRITE lady-boy: lady boy → ladyboy
- REWRITE lady-boy: lady-boy → ladyboy
- REWRITE leather-restraint: leather restraint → leatherrestraint
- DROP leather-straight-jacket: leather straight jacket → leatherstraightjacket
- REWRITE lemon-party: lemon party → lemonparty
- REWRITE leningrad-steamer: leningrad steamer → leningradsteamer
- EXCEPTION lesbo: *s → lesbos
- EXCEPTION lesbo: b*k → blesbok
- EXCEPTION lesbo: b*ks → blesboks
- EXCEPTION leso: bung*me → bunglesome
- EXCEPTION leso: chuck*me → chucklesome
- EXCEPTION leso: crad*ng → cradlesong
- EXCEPTION leso: crad*ngs → cradlesongs
- EXCEPTION leso: cudd*me → cuddlesome
- EXCEPTION leso: do*me → dolesome
- EXCEPTION leso: medd*me → meddlesome
- EXCEPTION leso: medd*meness → meddlesomeness
- EXCEPTION leso: mett*me → mettlesome
- EXCEPTION leso: nett*me → nettlesome
- EXCEPTION leso: troub*me → troublesome
- EXCEPTION leso: troub*mely → troublesomely
- EXCEPTION leso: troub*meness → troublesomeness
- EXCEPTION leso: unwho*me → unwholesome
- EXCEPTION leso: unwho*mely → unwholesomely
- EXCEPTION leso: who*me → wholesome
- EXCEPTION leso: who*mer → wholesomer
- EXCEPTION leso: who*mest → wholesomest
- EXCEPTION leso: who*mely → wholesomely
- EXCEPTION leso: who*meness → wholesomeness
- EXCEPTION leso: who*menesses → wholesomenesses
- REWRITE light-fedora: light in the fedora → lightinthefedora
- REWRITE light-loafers: light in the loafers → lightintheloafers
- REWRITE light-pants: light in the pants → lightinthepants
- REWRITE limp-wristed: limp wristed → limpwristed
- REWRITE limp-wristed: limp-wristed → limpwristed
- REWRITE male-squirting: male squirting → malesquirting
- REWRITE male-squirting: male-squirting → malesquirting
- REWRITE masturbate: ma*stu*rb8 → ma*stu*rbb
- REWRITE masturbate: masterb8 → masterbb
- REWRITE mayonnaise-monkey: mayonnaise monkey → mayonnaisemonkey
- REWRITE mayonnaise-monkey: mayonnaise monkies → mayonnaisemonkies
- REWRITE meat-masseuse: meat masseuse → meatmasseuse
- REWRITE meatspin: meat spin → meatspin
- REWRITE menage-a-trois: menage a trois → menageatrois
- REWRITE menage-a-trois: menage-a-trois → menageatrois
- REWRITE menage-a-trois: menages a trois → menagesatrois
- REWRITE menage-a-trois: menages-a-trois → menagesatrois
- REWRITE mexican-pancake: mexican pancake → mexicanpancake
- REWRITE milwaukee-blizzard: milwaukee blizzard → milwaukeeblizzard
- REWRITE missionary-position: missionary position → missionaryposition
- REWRITE mississippi-birdbath: mississippi birdbath → mississippibirdbath
- DROP mr-hands: mr. hands → mr.hands
- REWRITE mr-hands: mr hands → mrhands
- REWRITE muff-diver: muff diver → muffdiver
- REWRITE muff-diver: muff-diver → muffdiver
- REWRITE muffdiving: muff diving → muffdiving
- REWRITE muffdiving: muff diver → muffdiver
- REWRITE muscle-mary: muscle mary → musclemary
- REWRITE neonazi: neo-nazi → neonazi
- REWRITE neonazi: neo nazi → neonazi
- REWRITE nigerian-hurricane: nigerian hurricane → nigerianhurricane
- REWRITE nigga: nig nog → nignog
- REWRITE nipple-clamps: nipple clamps → nippleclamps
- REWRITE nipple-clamps: nipple clamp → nippleclamp
- REWRITE onlyfans: only fans → onlyfans
- REWRITE painslut: pain slut → painslut
- EXCEPTION paki: *hi → pakihi
- REWRITE panamanian-petting-zoo: panamanian petting zoo → panamanianpettingzoo
- REWRITE pedobear: pedo bear → pedobear
- REWRITE pedobear: paedo bear → paedobear
- REWRITE peterpuffer: peter-puffer → peterpuffer
- REWRITE peterpuffer: peter puffer → peterpuffer
- REWRITE petrol-sniffer: petrol sniffer → petrolsniffer
- REWRITE petrol-sniffer: petrol-sniffer → petrolsniffer
- REWRITE piece-of-shit: piece of shit → pieceofshit
- REWRITE piece-of-shit: pieces of shit → piecesofshit
- REWRITE piss-off: pi*ss* off → pi*ss*off
- REWRITE piss-pig: piss pig → pisspig
- REWRITE piss-pig: piss pig → pisspig
- REWRITE pissed-off: pi*ss*ed off → pi*ss*edoff
- REWRITE pleasure-chest: pleasure chest → pleasurechest
- REWRITE ponyboy: pony-boy → ponyboy
- REWRITE ponyboy: pony boy → ponyboy
- REWRITE ponygirl: pony-girl → ponygirl
- REWRITE ponygirl: pony girl → ponygirl
- REWRITE ponyplay: pony-play → ponyplay
- EXCEPTION poof: *s → poofs
- EXCEPTION poof: *tah → pooftah
- EXCEPTION poof: *tahs → pooftahs
- EXCEPTION poof: *ter → poofter
- EXCEPTION poof: *ters → poofters
- EXCEPTION poof: *y → poofy
- EXCEPTION poof: s* → spoof
- EXCEPTION poof: s*ed → spoofed
- EXCEPTION poof: s*er → spoofer
- EXCEPTION poof: s*eries → spooferies
- EXCEPTION poof: s*ers → spoofers
- EXCEPTION poof: s*ery → spoofery
- EXCEPTION poof: s*ing → spoofing
- EXCEPTION poof: s*s → spoofs
- EXCEPTION poof: s*y → spoofy
- EXCEPTION poon: cram* → crampoon
- EXCEPTION poon: cram*s → crampoons
- EXCEPTION poon: desserts* → dessertspoon
- EXCEPTION poon: desserts*ful → dessertspoonful
- EXCEPTION poon: desserts*s → dessertspoons
- EXCEPTION poon: har* → harpoon
- EXCEPTION poon: har*ed → harpooned
- EXCEPTION poon: har*er → harpooner
- EXCEPTION poon: har*ers → harpooners
- EXCEPTION poon: har*ing → harpooning
- EXCEPTION poon: har*s → harpoons
- EXCEPTION poon: lam* → lampoon
- EXCEPTION poon: lam*ed → lampooned
- EXCEPTION poon: lam*er → lampooner
- EXCEPTION poon: lam*eries → lampooneries
- EXCEPTION poon: lam*ers → lampooners
- EXCEPTION poon: lam*ery → lampoonery
- EXCEPTION poon: lam*ing → lampooning
- EXCEPTION poon: lam*s → lampoons
- EXCEPTION poon: s* → spoon
- EXCEPTION poon: s*bill → spoonbill
- EXCEPTION poon: s*bills → spoonbills
- EXCEPTION poon: s*ed → spooned
- EXCEPTION poon: s*erism → spoonerism
- EXCEPTION poon: s*erisms → spoonerisms
- EXCEPTION poon: s*ey → spooney
- EXCEPTION poon: s*eys → spooneys
- EXCEPTION poon: s*ful → spoonful
- EXCEPTION poon: s*fuls → spoonfuls
- EXCEPTION poon: s*ier → spoonier
- EXCEPTION poon: s*ies → spoonies
- EXCEPTION poon: s*iest → spooniest
- EXCEPTION poon: s*ily → spoonily
- EXCEPTION poon: s*ing → spooning
- EXCEPTION poon: s*s → spoons
- EXCEPTION poon: s*sful → spoonsful
- EXCEPTION poon: s*y → spoony
- EXCEPTION poon: soups* → soupspoon
- EXCEPTION poon: soups*s → soupspoons
- EXCEPTION poon: tables* → tablespoon
- EXCEPTION poon: tables*ful → tablespoonful
- EXCEPTION poon: tables*fuls → tablespoonfuls
- EXCEPTION poon: tables*s → tablespoons
- EXCEPTION poon: tables*sful → tablespoonsful
- EXCEPTION poon: teas* → teaspoon
- EXCEPTION poon: teas*ful → teaspoonful
- EXCEPTION poon: teas*fuls → teaspoonfuls
- EXCEPTION poon: teas*s → teaspoons
- EXCEPTION poon: teas*sful → teaspoonsful
- EXCEPTION poon: cram* → crampoontang
- EXCEPTION poon: cram*s → crampoontangs
- EXCEPTION poon: desserts* → dessertspoontang
- EXCEPTION poon: desserts*ful → dessertspoontangful
- EXCEPTION poon: desserts*s → dessertspoontangs
- EXCEPTION poon: har* → harpoontang
- EXCEPTION poon: har*ed → harpoontanged
- EXCEPTION poon: har*er → harpoontanger
- EXCEPTION poon: har*ers → harpoontangers
- EXCEPTION poon: har*ing → harpoontanging
- EXCEPTION poon: har*s → harpoontangs
- EXCEPTION poon: lam* → lampoontang
- EXCEPTION poon: lam*ed → lampoontanged
- EXCEPTION poon: lam*er → lampoontanger
- EXCEPTION poon: lam*eries → lampoontangeries
- EXCEPTION poon: lam*ers → lampoontangers
- EXCEPTION poon: lam*ery → lampoontangery
- EXCEPTION poon: lam*ing → lampoontanging
- EXCEPTION poon: lam*s → lampoontangs
- EXCEPTION poon: s* → spoontang
- EXCEPTION poon: s*bill → spoontangbill
- EXCEPTION poon: s*bills → spoontangbills
- EXCEPTION poon: s*ed → spoontanged
- EXCEPTION poon: s*erism → spoontangerism
- EXCEPTION poon: s*erisms → spoontangerisms
- EXCEPTION poon: s*ey → spoontangey
- EXCEPTION poon: s*eys → spoontangeys
- EXCEPTION poon: s*ful → spoontangful
- EXCEPTION poon: s*fuls → spoontangfuls
- EXCEPTION poon: s*ier → spoontangier
- EXCEPTION poon: s*ies → spoontangies
- EXCEPTION poon: s*iest → spoontangiest
- EXCEPTION poon: s*ily → spoontangily
- EXCEPTION poon: s*ing → spoontanging
- EXCEPTION poon: s*s → spoontangs
- EXCEPTION poon: s*sful → spoontangsful
- EXCEPTION poon: s*y → spoontangy
- EXCEPTION poon: soups* → soupspoontang
- EXCEPTION poon: soups*s → soupspoontangs
- EXCEPTION poon: tables* → tablespoontang
- EXCEPTION poon: tables*ful → tablespoontangful
- EXCEPTION poon: tables*fuls → tablespoontangfuls
- EXCEPTION poon: tables*s → tablespoontangs
- EXCEPTION poon: tables*sful → tablespoontangsful
- EXCEPTION poon: teas* → teaspoontang
- EXCEPTION poon: teas*ful → teaspoontangful
- EXCEPTION poon: teas*fuls → teaspoontangfuls
- EXCEPTION poon: teas*s → teaspoontangs
- EXCEPTION poon: teas*sful → teaspoontangsful
- REWRITE poop-chute: poop chute → poopchute
- REWRITE pornhub: porn hub → pornhub
- REWRITE potato-queen: potato queen → potatoqueen
- REWRITE prince-albert-piercing: prince albert piercing → princealbertpiercing
- REWRITE pussy-puncher: pussy puncher → pussypuncher
- REWRITE pussy-puncher: pussy-puncher → pussypuncher
- REWRITE raghead: rag head → raghead
- REWRITE raghead: rag heads → ragheads
- REWRITE ramen-yarmulke: ramen yarmulke → ramenyarmulke
- REWRITE reverse-cowgirl: reverse cowgirl → reversecowgirl
- REWRITE rice-queen: rice queen → ricequeen
- REWRITE ring-raider: ring raider → ringraider
- REWRITE rusty-trombone: rusty trombone → rustytrombone
- REWRITE sand-nigger: sand ni*gg*e*r → sandni*gg*e*r
- REWRITE sand-nigger: sand-ni*gg*e*r → sandni*gg*e*r
- REWRITE shaved pussy: shaved pussy → shavedpussy
- REWRITE shaved pussy: shaved beaver → shavedbeaver
- REWRITE sheepshagger: sheep shagger → sheepshagger
- REWRITE shemale: she-male → shemale
- REWRITE shemale: she male → shemale
- REWRITE shithead: shit head → shithead
- REWRITE skittles-harvest: skittles harvest → skittlesharvest
- REWRITE skittles-harvest: skittle harvest → skittleharvest
- REWRITE slanteye: slant-eye → slanteye
- REWRITE slanteye: slant eye → slanteye
- REWRITE sod-off: sod off → sodoff
- EXCEPTION spic: *a → spica
- EXCEPTION spic: *ae → spicae
- EXCEPTION spic: *as → spicas
- EXCEPTION spic: *ate → spicate
- EXCEPTION spic: *ated → spicated
- EXCEPTION spic: *cato → spiccato
- EXCEPTION spic: *catos → spiccatos
- EXCEPTION spic: *e → spice
- EXCEPTION spic: *ebush → spicebush
- EXCEPTION spic: *ebushes → spicebushes
- EXCEPTION spic: *ed → spiced
- EXCEPTION spic: *eless → spiceless
- EXCEPTION spic: *er → spicer
- EXCEPTION spic: *eries → spiceries
- EXCEPTION spic: *ers → spicers
- EXCEPTION spic: *ery → spicery
- EXCEPTION spic: *es → spices
- EXCEPTION spic: *ey → spicey
- EXCEPTION spic: *ier → spicier
- EXCEPTION spic: *iest → spiciest
- EXCEPTION spic: *ily → spicily
- EXCEPTION spic: *iness → spiciness
- EXCEPTION spic: *inesses → spicinesses
- EXCEPTION spic: *ing → spicing
- EXCEPTION spic: *ks → spicks
- EXCEPTION spic: *ula → spicula
- EXCEPTION spic: *ulae → spiculae
- EXCEPTION spic: *ular → spicular
- EXCEPTION spic: *ulate → spiculate
- EXCEPTION spic: *ulation → spiculation
- EXCEPTION spic: *ulations → spiculations
- EXCEPTION spic: *ule → spicule
- EXCEPTION spic: *ules → spicules
- EXCEPTION spic: *ulum → spiculum
- EXCEPTION spic: *y → spicy
- EXCEPTION spic: a* → aspic
- EXCEPTION spic: a*s → aspics
- EXCEPTION spic: all*e → allspice
- EXCEPTION spic: all*es → allspices
- EXCEPTION spic: aru*es → aruspices
- EXCEPTION spic: au*ate → auspicate
- EXCEPTION spic: au*ated → auspicated
- EXCEPTION spic: au*ates → auspicates
- EXCEPTION spic: au*ating → auspicating
- EXCEPTION spic: au*e → auspice
- EXCEPTION spic: au*es → auspices
- EXCEPTION spic: au*ious → auspicious
- EXCEPTION spic: au*iously → auspiciously
- EXCEPTION spic: au*iousness → auspiciousness
- EXCEPTION spic: con*uities → conspicuities
- EXCEPTION spic: con*uity → conspicuity
- EXCEPTION spic: con*uous → conspicuous
- EXCEPTION spic: con*uously → conspicuously
- EXCEPTION spic: con*uousness → conspicuousness
- EXCEPTION spic: de*able → despicable
- EXCEPTION spic: de*ableness → despicableness
- EXCEPTION spic: de*ably → despicably
- EXCEPTION spic: haru*ation → haruspication
- EXCEPTION spic: haru*ations → haruspications
- EXCEPTION spic: haru*es → haruspices
- EXCEPTION spic: ho*e → hospice
- EXCEPTION spic: ho*es → hospices
- EXCEPTION spic: inau*ious → inauspicious
- EXCEPTION spic: inau*iously → inauspiciously
- EXCEPTION spic: incon*uous → inconspicuous
- EXCEPTION spic: incon*uously → inconspicuously
- EXCEPTION spic: mi*kel → mispickel
- EXCEPTION spic: mi*kels → mispickels
- EXCEPTION spic: over*e → overspice
- EXCEPTION spic: over*ed → overspiced
- EXCEPTION spic: over*es → overspices
- EXCEPTION spic: over*ing → overspicing
- EXCEPTION spic: oversu*ious → oversuspicious
- EXCEPTION spic: per*acious → perspicacious
- EXCEPTION spic: per*aciously → perspicaciously
- EXCEPTION spic: per*acities → perspicacities
- EXCEPTION spic: per*acity → perspicacity
- EXCEPTION spic: per*uities → perspicuities
- EXCEPTION spic: per*uity → perspicuity
- EXCEPTION spic: per*uous → perspicuous
- EXCEPTION spic: per*uously → perspicuously
- EXCEPTION spic: per*uousness → perspicuousness
- EXCEPTION spic: su*ion → suspicion
- EXCEPTION spic: su*ioned → suspicioned
- EXCEPTION spic: su*ioning → suspicioning
- EXCEPTION spic: su*ions → suspicions
- EXCEPTION spic: su*ious → suspicious
- EXCEPTION spic: su*iously → suspiciously
- EXCEPTION spic: su*iousness → suspiciousness
- EXCEPTION spic: tran*uous → transpicuous
- EXCEPTION spic: unsu*ious → unsuspicious
- EXCEPTION spic: *a → spicsa
- EXCEPTION spic: *ae → spicsae
- EXCEPTION spic: *as → spicsas
- EXCEPTION spic: *ate → spicsate
- EXCEPTION spic: *ated → spicsated
- EXCEPTION spic: *cato → spicscato
- EXCEPTION spic: *catos → spicscatos
- EXCEPTION spic: *e → spicse
- EXCEPTION spic: *ebush → spicsebush
- EXCEPTION spic: *ebushes → spicsebushes
- EXCEPTION spic: *ed → spicsed
- EXCEPTION spic: *eless → spicseless
- EXCEPTION spic: *er → spicser
- EXCEPTION spic: *eries → spicseries
- EXCEPTION spic: *ers → spicsers
- EXCEPTION spic: *ery → spicsery
- EXCEPTION spic: *es → spicses
- EXCEPTION spic: *ey → spicsey
- EXCEPTION spic: *ier → spicsier
- EXCEPTION spic: *iest → spicsiest
- EXCEPTION spic: *ily → spicsily
- EXCEPTION spic: *iness → spicsiness
- EXCEPTION spic: *inesses → spicsinesses
- EXCEPTION spic: *ing → spicsing
- EXCEPTION spic: *ks → spicsks
- EXCEPTION spic: *ula → spicsula
- EXCEPTION spic: *ulae → spicsulae
- EXCEPTION spic: *ular → spicsular
- EXCEPTION spic: *ulate → spicsulate
- EXCEPTION spic: *ulation → spicsulation
- EXCEPTION spic: *ulations → spicsulations
- EXCEPTION spic: *ule → spicsule
- EXCEPTION spic: *ules → spicsules
- EXCEPTION spic: *ulum → spicsulum
- EXCEPTION spic: *y → spicsy
- EXCEPTION spic: a* → aspics
- EXCEPTION spic: a*s → aspicss
- EXCEPTION spic: all*e → allspicse
- EXCEPTION spic: all*es → allspicses
- EXCEPTION spic: aru*es → aruspicses
- EXCEPTION spic: au*ate → auspicsate
- EXCEPTION spic: au*ated → auspicsated
- EXCEPTION spic: au*ates → auspicsates
- EXCEPTION spic: au*ating → auspicsating
- EXCEPTION spic: au*e → auspicse
- EXCEPTION spic: au*es → auspicses
- EXCEPTION spic: au*ious → auspicsious
- EXCEPTION spic: au*iously → auspicsiously
- EXCEPTION spic: au*iousness → auspicsiousness
- EXCEPTION spic: con*uities → conspicsuities
- EXCEPTION spic: con*uity → conspicsuity
- EXCEPTION spic: con*uous → conspicsuous
- EXCEPTION spic: con*uously → conspicsuously
- EXCEPTION spic: con*uousness → conspicsuousness
- EXCEPTION spic: de*able → despicsable
- EXCEPTION spic: de*ableness → despicsableness
- EXCEPTION spic: de*ably → despicsably
- EXCEPTION spic: haru*ation → haruspicsation
- EXCEPTION spic: haru*ations → haruspicsations
- EXCEPTION spic: haru*es → haruspicses
- EXCEPTION spic: ho*e → hospicse
- EXCEPTION spic: ho*es → hospicses
- EXCEPTION spic: inau*ious → inauspicsious
- EXCEPTION spic: inau*iously → inauspicsiously
- EXCEPTION spic: incon*uous → inconspicsuous
- EXCEPTION spic: incon*uously → inconspicsuously
- EXCEPTION spic: mi*kel → mispicskel
- EXCEPTION spic: mi*kels → mispicskels
- EXCEPTION spic: over*e → overspicse
- EXCEPTION spic: over*ed → overspicsed
- EXCEPTION spic: over*es → overspicses
- EXCEPTION spic: over*ing → overspicsing
- EXCEPTION spic: oversu*ious → oversuspicsious
- EXCEPTION spic: per*acious → perspicsacious
- EXCEPTION spic: per*aciously → perspicsaciously
- EXCEPTION spic: per*acities → perspicsacities
- EXCEPTION spic: per*acity → perspicsacity
- EXCEPTION spic: per*uities → perspicsuities
- EXCEPTION spic: per*uity → perspicsuity
- EXCEPTION spic: per*uous → perspicsuous
- EXCEPTION spic: per*uously → perspicsuously
- EXCEPTION spic: per*uousness → perspicsuousness
- EXCEPTION spic: su*ion → suspicsion
- EXCEPTION spic: su*ioned → suspicsioned
- EXCEPTION spic: su*ioning → suspicsioning
- EXCEPTION spic: su*ions → suspicsions
- EXCEPTION spic: su*ious → suspicsious
- EXCEPTION spic: su*iously → suspicsiously
- EXCEPTION spic: su*iousness → suspicsiousness
- EXCEPTION spic: tran*uous → transpicsuous
- EXCEPTION spic: unsu*ious → unsuspicsious
- EXCEPTION spic: *a → spicka
- EXCEPTION spic: *ae → spickae
- EXCEPTION spic: *as → spickas
- EXCEPTION spic: *ate → spickate
- EXCEPTION spic: *ated → spickated
- EXCEPTION spic: *cato → spickcato
- EXCEPTION spic: *catos → spickcatos
- EXCEPTION spic: *e → spicke
- EXCEPTION spic: *ebush → spickebush
- EXCEPTION spic: *ebushes → spickebushes
- EXCEPTION spic: *ed → spicked
- EXCEPTION spic: *eless → spickeless
- EXCEPTION spic: *er → spicker
- EXCEPTION spic: *eries → spickeries
- EXCEPTION spic: *ers → spickers
- EXCEPTION spic: *ery → spickery
- EXCEPTION spic: *es → spickes
- EXCEPTION spic: *ey → spickey
- EXCEPTION spic: *ier → spickier
- EXCEPTION spic: *iest → spickiest
- EXCEPTION spic: *ily → spickily
- EXCEPTION spic: *iness → spickiness
- EXCEPTION spic: *inesses → spickinesses
- EXCEPTION spic: *ing → spicking
- EXCEPTION spic: *ks → spickks
- EXCEPTION spic: *ula → spickula
- EXCEPTION spic: *ulae → spickulae
- EXCEPTION spic: *ular → spickular
- EXCEPTION spic: *ulate → spickulate
- EXCEPTION spic: *ulation → spickulation
- EXCEPTION spic: *ulations → spickulations
- EXCEPTION spic: *ule → spickule
- EXCEPTION spic: *ules → spickules
- EXCEPTION spic: *ulum → spickulum
- EXCEPTION spic: *y → spicky
- EXCEPTION spic: a* → aspick
- EXCEPTION spic: a*s → aspicks
- EXCEPTION spic: all*e → allspicke
- EXCEPTION spic: all*es → allspickes
- EXCEPTION spic: aru*es → aruspickes
- EXCEPTION spic: au*ate → auspickate
- EXCEPTION spic: au*ated → auspickated
- EXCEPTION spic: au*ates → auspickates
- EXCEPTION spic: au*ating → auspickating
- EXCEPTION spic: au*e → auspicke
- EXCEPTION spic: au*es → auspickes
- EXCEPTION spic: au*ious → auspickious
- EXCEPTION spic: au*iously → auspickiously
- EXCEPTION spic: au*iousness → auspickiousness
- EXCEPTION spic: con*uities → conspickuities
- EXCEPTION spic: con*uity → conspickuity
- EXCEPTION spic: con*uous → conspickuous
- EXCEPTION spic: con*uously → conspickuously
- EXCEPTION spic: con*uousness → conspickuousness
- EXCEPTION spic: de*able → despickable
- EXCEPTION spic: de*ableness → despickableness
- EXCEPTION spic: de*ably → despickably
- EXCEPTION spic: haru*ation → haruspickation
- EXCEPTION spic: haru*ations → haruspickations
- EXCEPTION spic: haru*es → haruspickes
- EXCEPTION spic: ho*e → hospicke
- EXCEPTION spic: ho*es → hospickes
- EXCEPTION spic: inau*ious → inauspickious
- EXCEPTION spic: inau*iously → inauspickiously
- EXCEPTION spic: incon*uous → inconspickuous
- EXCEPTION spic: incon*uously → inconspickuously
- EXCEPTION spic: mi*kel → mispickkel
- EXCEPTION spic: mi*kels → mispickkels
- EXCEPTION spic: over*e → overspicke
- EXCEPTION spic: over*ed → overspicked
- EXCEPTION spic: over*es → overspickes
- EXCEPTION spic: over*ing → overspicking
- EXCEPTION spic: oversu*ious → oversuspickious
- EXCEPTION spic: per*acious → perspickacious
- EXCEPTION spic: per*aciously → perspickaciously
- EXCEPTION spic: per*acities → perspickacities
- EXCEPTION spic: per*acity → perspickacity
- EXCEPTION spic: per*uities → perspickuities
- EXCEPTION spic: per*uity → perspickuity
- EXCEPTION spic: per*uous → perspickuous
- EXCEPTION spic: per*uously → perspickuously
- EXCEPTION spic: per*uousness → perspickuousness
- EXCEPTION spic: su*ion → suspickion
- EXCEPTION spic: su*ioned → suspickioned
- EXCEPTION spic: su*ioning → suspickioning
- EXCEPTION spic: su*ions → suspickions
- EXCEPTION spic: su*ious → suspickious
- EXCEPTION spic: su*iously → suspickiously
- EXCEPTION spic: su*iousness → suspickiousness
- EXCEPTION spic: tran*uous → transpickuous
- EXCEPTION spic: unsu*ious → unsuspickious
- EXCEPTION spic: *a → spicksa
- EXCEPTION spic: *ae → spicksae
- EXCEPTION spic: *as → spicksas
- EXCEPTION spic: *ate → spicksate
- EXCEPTION spic: *ated → spicksated
- EXCEPTION spic: *cato → spickscato
- EXCEPTION spic: *catos → spickscatos
- EXCEPTION spic: *e → spickse
- EXCEPTION spic: *ebush → spicksebush
- EXCEPTION spic: *ebushes → spicksebushes
- EXCEPTION spic: *ed → spicksed
- EXCEPTION spic: *eless → spickseless
- EXCEPTION spic: *er → spickser
- EXCEPTION spic: *eries → spickseries
- EXCEPTION spic: *ers → spicksers
- EXCEPTION spic: *ery → spicksery
- EXCEPTION spic: *es → spickses
- EXCEPTION spic: *ey → spicksey
- EXCEPTION spic: *ier → spicksier
- EXCEPTION spic: *iest → spicksiest
- EXCEPTION spic: *ily → spicksily
- EXCEPTION spic: *iness → spicksiness
- EXCEPTION spic: *inesses → spicksinesses
- EXCEPTION spic: *ing → spicksing
- EXCEPTION spic: *ks → spicksks
- EXCEPTION spic: *ula → spicksula
- EXCEPTION spic: *ulae → spicksulae
- EXCEPTION spic: *ular → spicksular
- EXCEPTION spic: *ulate → spicksulate
- EXCEPTION spic: *ulation → spicksulation
- EXCEPTION spic: *ulations → spicksulations
- EXCEPTION spic: *ule → spicksule
- EXCEPTION spic: *ules → spicksules
- EXCEPTION spic: *ulum → spicksulum
- EXCEPTION spic: *y → spicksy
- EXCEPTION spic: a* → aspicks
- EXCEPTION spic: a*s → aspickss
- EXCEPTION spic: all*e → allspickse
- EXCEPTION spic: all*es → allspickses
- EXCEPTION spic: aru*es → aruspickses
- EXCEPTION spic: au*ate → auspicksate
- EXCEPTION spic: au*ated → auspicksated
- EXCEPTION spic: au*ates → auspicksates
- EXCEPTION spic: au*ating → auspicksating
- EXCEPTION spic: au*e → auspickse
- EXCEPTION spic: au*es → auspickses
- EXCEPTION spic: au*ious → auspicksious
- EXCEPTION spic: au*iously → auspicksiously
- EXCEPTION spic: au*iousness → auspicksiousness
- EXCEPTION spic: con*uities → conspicksuities
- EXCEPTION spic: con*uity → conspicksuity
- EXCEPTION spic: con*uous → conspicksuous
- EXCEPTION spic: con*uously → conspicksuously
- EXCEPTION spic: con*uousness → conspicksuousness
- EXCEPTION spic: de*able → despicksable
- EXCEPTION spic: de*ableness → despicksableness
- EXCEPTION spic: de*ably → despicksably
- EXCEPTION spic: haru*ation → haruspicksation
- EXCEPTION spic: haru*ations → haruspicksations
- EXCEPTION spic: haru*es → haruspickses
- EXCEPTION spic: ho*e → hospickse
- EXCEPTION spic: ho*es → hospickses
- EXCEPTION spic: inau*ious → inauspicksious
- EXCEPTION spic: inau*iously → inauspicksiously
- EXCEPTION spic: incon*uous → inconspicksuous
- EXCEPTION spic: incon*uously → inconspicksuously
- EXCEPTION spic: mi*kel → mispickskel
- EXCEPTION spic: mi*kels → mispickskels
- EXCEPTION spic: over*e → overspickse
- EXCEPTION spic: over*ed → overspicksed
- EXCEPTION spic: over*es → overspickses
- EXCEPTION spic: over*ing → overspicksing
- EXCEPTION spic: oversu*ious → oversuspicksious
- EXCEPTION spic: per*acious → perspicksacious
- EXCEPTION spic: per*aciously → perspicksaciously
- EXCEPTION spic: per*acities → perspicksacities
- EXCEPTION spic: per*acity → perspicksacity
- EXCEPTION spic: per*uities → perspicksuities
- EXCEPTION spic: per*uity → perspicksuity
- EXCEPTION spic: per*uous → perspicksuous
- EXCEPTION spic: per*uously → perspicksuously
- EXCEPTION spic: per*uousness → perspicksuousness
- EXCEPTION spic: su*ion → suspicksion
- EXCEPTION spic: su*ioned → suspicksioned
- EXCEPTION spic: su*ioning → suspicksioning
- EXCEPTION spic: su*ions → suspicksions
- EXCEPTION spic: su*ious → suspicksious
- EXCEPTION spic: su*iously → suspicksiously
- EXCEPTION spic: su*iousness → suspicksiousness
- EXCEPTION spic: tran*uous → transpicksuous
- EXCEPTION spic: unsu*ious → unsuspicksious
- REWRITE spicy-gringo: spicy gringo → spicygringo
- REWRITE splooge: splooge moose → sploogemoose
- REWRITE strap-on: strap on → strapon
- REWRITE strap-on: strap-on → strapon
- REWRITE strap-on: strap-on → strapon
- REWRITE swamp-guinea: swamp guinea → swampguinea
- REWRITE swamp-guinea: swamp-guinea → swampguinea
- REWRITE switch-hitter: switch hitter → switchhitter
- REWRITE t-girl: t-girl → tgirl
- REWRITE tea-bagging: tea bagging → teabagging
- REWRITE tea-bagging: tea-bagging → teabagging
- REWRITE tea-bagging: tea bagged → teabagged
- REWRITE tea-bagging: tea-bagged → teabagged
- REWRITE timber-nigger: timber ni*gg*e*r → timberni*gg*e*r
- REWRITE timber-nigger: timber-ni*gg*e*r → timberni*gg*e*r
- REWRITE towelhead: towel-head → towelhead
- REWRITE towelhead: towel head → towelhead
- REWRITE tubgirl: tub girl → tubgirl
- EXCEPTION twat: cu*er → cutwater
- EXCEPTION twat: mel*er → meltwater
- EXCEPTION twat: ou*ch → outwatch
- EXCEPTION twat: sal*er → saltwater
- EXCEPTION twat: wris*ch → wristwatch
- EXCEPTION twink: *ie → twinkie
- EXCEPTION twink: *ies → twinkies
- EXCEPTION twink: *le → twinkle
- EXCEPTION twink: *led → twinkled
- EXCEPTION twink: *ler → twinkler
- EXCEPTION twink: *les → twinkles
- EXCEPTION twink: *lers → twinklers
- EXCEPTION twink: *ling → twinkling
- EXCEPTION twink: *lings → twinklings
- EXCEPTION twink: *ly → twinkly
- REWRITE urethra-play: urethra play → urethraplay
- REWRITE venus-mound: venus mound → venusmound
- REWRITE venus-mound: mound of venus → moundofvenus
- REWRITE violet-wand: violet wand → violetwand
- REWRITE wagon-burner: wagon burner → wagonburner
- REWRITE wagon-burner: wagon-burner → wagonburner
- REWRITE wax-play: wax play → waxplay
- REWRITE wax-play: wax-play → waxplay
- REWRITE wet-dream: wet dream → wetdream
- REWRITE wetback: wet-back → wetback
- REWRITE wetback: wet back → wetback
- REWRITE white power: white-power → whitepower
- REWRITE white power: white power → whitepower
- REWRITE wrapping-men: wrapping men → wrappingmen
- REWRITE wrinkled-starfish: wrinkled starfish → wrinkledstarfish
- REWRITE zipperhead: zipper-head → zipperhead
- REWRITE zipperhead: zipper head → zipperhead
- REWRITE zippocat: zippo-cat → zippocat
- REWRITE zippocat: zippo cat → zippocat
- DROP reserved: #
- DROP reserved: -
- DROP reserved: 0
- DROP reserved: 1
- DROP reserved: 2
- DROP reserved: 3
- DROP reserved: 4
- DROP reserved: 5
- DROP reserved: 6
- DROP reserved: 7
- DROP reserved: 8
- DROP reserved: 9
- DROP reserved: _
- DROP reserved: a
- DROP reserved: b
- DROP reserved: c
- DROP reserved: cp
- DROP reserved: d
- DROP reserved: db
- DROP reserved: ds_store
- DROP reserved: e
- DROP reserved: f
- DROP reserved: g
- DROP reserved: go
- DROP reserved: h
- DROP reserved: i
- DROP reserved: j
- DROP reserved: js
- DROP reserved: k
- DROP reserved: l
- DROP reserved: m
- DROP reserved: mach_kernal
- DROP reserved: mail-exchange
- DROP reserved: mail_exchange
- DROP reserved: me
- DROP reserved: mx
- DROP reserved: my
- DROP reserved: n
- DROP reserved: ns
- DROP reserved: o
- DROP reserved: p
- DROP reserved: privacy-policy
- DROP reserved: privacy_policy
- DROP reserved: public_html
- DROP reserved: q
- DROP reserved: r
- DROP reserved: s
- DROP reserved: su
- DROP reserved: t
- DROP reserved: terms-of-service
- DROP reserved: terms_of_service
- DROP reserved: ts
- DROP reserved: tv
- DROP reserved: u
- DROP reserved: v
- DROP reserved: vm
- DROP reserved: vv
- DROP reserved: w
- DROP reserved: w3
- DROP reserved: wp-activate
- DROP reserved: wp-admin
- DROP reserved: wp-blog-header
- DROP reserved: wp-comments-post
- DROP reserved: wp-config
- DROP reserved: wp-config-sample
- DROP reserved: wp-content
- DROP reserved: wp-cron
- DROP reserved: wp-includes
- DROP reserved: wp-links-opml
- DROP reserved: wp-load
- DROP reserved: wp-login
- DROP reserved: wp-mail
- DROP reserved: wp-settings
- DROP reserved: wp-signup
- DROP reserved: wp-trackback
- DROP reserved: ww
- DROP reserved: www-data
- DROP reserved: x
- DROP reserved: y
- DROP reserved: z

## Cost and application

About 1,100 rows per check; regexes contain only validated letters and repetition, names are at most 20 characters, and masking never joins fragments. No arbitrary source regex syntax is executed. Apply forward, seed, then verification. Generated-source conflicts preserve owner rows; inspect effective results after any owner customization.
