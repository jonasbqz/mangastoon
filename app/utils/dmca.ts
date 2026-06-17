const DMCA_BLOCKED_IDS = new Set([
  "4bafceb5-c1b9-46f7-928d-3ff01b6627b4", // O Ultimo Saiyuki
  "141609b6-cf86-4266-904c-6648f389cdc9", // RuriDragon
  "c0defdaa-e9eb-4c7d-ae27-db989fcf0105", // Viz Manga reported listing
  "1044287a-73df-48d0-b0b2-5327f32dd651", // JoJo's Bizarre Adventure Part 7: Steel Ball Run
  "47e5c76d-1420-4bfa-a973-90524c9d6f13", // Pokemon Adventures
  "a7a8149f-65cf-4cab-a243-9b00b91e3b24", // Toriko
  "ff5c207a-c0e0-45c7-b623-317b05c2100f", // Trinity Blood
  "fcf1aa35-4891-46a3-9874-f1823ddac415", // Twin Star Exorcists
  "af857779-a400-46ef-917a-3b3a248e2221", // Ultimate Muscle 2: Ultimate Chojin Tag Arc
  "df83fcb3-7ed7-4357-baa1-6043fb42542d", // Ultraman Blazar
  "503ce7a9-032a-4178-812d-fd089a755fd0", // Ultraman Nexus
  "cc1b8669-82b2-4232-99c1-40d48fc2d988", // Undead Unluck
  "d1a9fdeb-f713-407f-960c-8326b586e6fd", // Vagabond
  "baaa0ca4-efef-4b15-b91a-c1f85692c2a7", // Vampire Knight
  "38221d4a-687d-49bc-a2f4-44ce42fab8d9", // Vampire Knight Memories
  "7ae7fcbc-0aee-417d-9262-be4d5beac3ca", // Wild Strawberry
  "4801f266-cc4e-4c3b-8d1d-f50f08b25b62", // Witch Watch
  "7ae7067a-7e68-4bd2-a064-5e3e3c059078", // World Trigger
  "18543708-eed6-4b84-b3fd-f67540b4ebbd", // Yaiba: Samurai Legend
  "500ac84c-959c-4d6d-bea4-1ebcee2aea67", // Yo-Kai Watch
  "3bb0279f-a01d-4aa4-93e4-305800f4b83e", // Yona of the Dawn
  "eb95c066-5f46-483a-af69-a83b5cf324ee", // You and I Are Polar Opposites
  "5a96c030-82b6-40f4-aa0f-c590b6f69f03", // Yu-Gi-Oh! 5D's
  "5be13aa8-95f7-40f0-b0d2-7e3fd6341999", // Yu-Gi-Oh! Duelist
  "a6d25f47-17e2-49d9-b690-296cb4cac8ed", // Yu-Gi-Oh! Go Rush!!
  "3e3604cc-97b5-43f0-ab2c-c144debcae87", // Yu-Gi-Oh! OCG Stories
  "1c258c7a-5529-4fde-b6c0-f8028223993b", // Yu-Gi-Oh! OCG Structures
  "9a7110a4-3610-4646-bbe5-716e2d0a0082", // Yu-Gi-Oh! Transcend Game
  "bd40d291-b66e-4d4c-b02f-d47555d8bd6d", // Yu-Gi-Oh!
  "0ca29dc2-6e44-408d-aa02-3e8e93d87532", // YuYu Hakusho Digital Colored Comics
  "866b3256-125d-4527-be9c-952cd7c89ea6", // A Man Who Defies the World of BL
  "90ff517c-a999-41ff-a94a-b2a74f6d800c", // A Star Brighter Than the Sun
  "9571d13f-1c66-4a27-a0ef-593fea7655b7", // A Town That's Too Convenient for Me
  "4d427b63-daa4-496b-b5a5-e459535d9b06", // Free and Easy Harem in Another World
  "cad04eb4-8d22-4dd4-9ef3-f347fbf30452", // Let's Make a Harem in a Zombie World
  "7aca9347-6757-4415-a340-4d892ccaf798", // More Peace Than a Harem in Another World
  "792e28fb-27be-425d-b92a-64e2d5474657", // Akane-banashi
  "f5c25341-d6ff-4585-8548-3a48fc7654d9", // Akira Failing in Love
  "665766a3-905d-4a71-a90a-bd2c75d1a81f", // Alice in Borderland
  "9047286f-ea5b-475a-84cc-a2533983ffe9", // Asadora
  "eb6c448c-619a-4b6c-8cd4-6e31da5541fa", // Ask and You Will Receive
  "333f4d22-7753-4e3b-b0da-0a69b2cdce4f", // Assassination Classroom
  "2ab3af7e-d024-43ce-8abf-676063c8fe5a", // Astro Baby
  "28e35701-de99-4f42-bd2c-2e9f9e43fe4e", // Ayashimon
  "fa3e0b2f-4e1f-48ee-9af0-1de9dc28ca51", // Bakuman
  "9a502e35-1051-4e4c-b055-5ab211954fa4", // Banana Fish
  "5da92b11-42ff-4adc-89b2-072cfd7a12df", // Beast Complex
  "1d2aac6a-2bb4-4571-8f1a-c90bac6624dd", // Beyblade
  "f1845adf-270b-4405-9438-0c56b1b9576c", // Beyblade X
  "e7eabe96-aa17-476f-b431-2497d5e9d060", // Black Clover
  "b969be8b-e2b3-4f52-9c6f-37bbd65ad249", // Black or White
  "7b4abd68-7d0b-40c7-9fe9-10e7f097a1c2", // Black Torch
  "06a37094-b3ba-4f25-bf2b-54c9751e0e91", // Bleach 0
  "239d6260-d71f-43b0-afff-074e3619e3de", // Bleach
  "a460ab18-22c1-47eb-a08a-9ee85fe37ec8", // Bleach Digital Colored Comics
  "cd275293-86e7-451a-aff4-04ff70363a93", // Bleach Koisenshou Doujinshi
  "0033cf32-ed14-41fc-9aba-a2bb5946f310", // Bleach Unmasked
  "ed5dddc0-999d-4fd2-a702-9fef1ec2c955", // Blue Box
  "3ee952f1-45c7-4c39-aea2-7df7676606d4", // Blue Exorcist
  "46e530ce-0766-4cbd-b005-5e6fb0ba5e71", // Boruto: Naruto Next Generations
  "6b1eb93e-473a-4ab3-9922-1a66d2a29a4a", // Naruto
  "99a704b4-e338-464a-8fc7-f67d69caaf22", // Naruto Daughter
  "a787b10a-02d0-46c0-8236-0d01d69ad4a3", // Naruto Digital Colored Comics
  "d5e0431b-3410-4bbe-a147-4ce50fb21bd6", // Naruto: The Whorl Within the Spiral
  "275c3ee8-bdeb-4070-a333-6add23a8415a", // Renge and Naruto
  "0b094aab-0cfb-4837-a49b-7267bdb86bec", // Boruto: Two Blue Vortex
  "1b03c975-1ad9-44ec-a407-9386ebf26edf", // Boruto: Two Blue Vortex Fan Colored
  "259dfd8a-f06a-4825-8fa6-a2dcd7274230", // Call of the Night
  "326be699-c9b8-41a5-b990-369f60256d15", // Call of the Night: Paradise Arc
  "7f30dfc3-0b80-4dcc-a3b9-0cd746fac005", // Case Closed
  "f4cc7c21-8753-448c-9542-cecb6bb0634c", // Case Closed: Magician of the Silver Sky
  "bdb64c74-cfc5-4a78-98ee-4dfcfd3f3343", // Case Closed: The Culprit Hanzawa
  "54e5d979-2f1b-4b7b-a704-fbd0b568b8b3", // Cats of the Louvre
  "a77742b1-befd-49a4-bff5-1ad4e6b0ef7b", // Chainsaw Man
  "e896c48c-3150-437d-ba57-d8567eb399ae", // Chainsaw Man Digital Colored Comics
  "11b74211-f4c0-4f08-b5a4-c491da0d0c0b", // Choujin X
  "b6886009-e60b-44a7-abc2-a575765277ba", // D.Gray-man
  "68112dc1-2b80-4f20-beb8-2f2a8716a430", // Dandadan
  "d64b0768-bebe-433c-b923-99870503c0a3", // Dark Gathering
  "7baa8582-79fe-4939-872d-539365ad32ae", // DD Fist of the North Star
  "8be4e41b-6dc6-4840-ae4a-bbe74d75086b", // Fist of the North Star DJ
  "fddba606-d598-40b8-9ba5-f69a129305eb", // Dear Anemone
  "75ee72ab-c6bf-4b87-badd-de839156934c", // Death Note
  "85b6f4e4-180b-43b0-a0ec-9a9de401aed0", // Death Note Digital Colored Comics
  "fa83bc33-e906-4a6a-af2f-a6da70a1c585", // Death Note Doujinshi
  "1fd20767-f5fc-4228-a2fc-c88497eee318", // JoJo x Death Note Doujinshi
  "789642f8-ca89-4e4e-8f7b-eee4d17ea08b", // Demon Slayer
  "cc600f4e-741f-4b49-bfb3-831b194c467a", // Demon Slayer Doujinshi
  "949b20c3-de22-4e7b-989f-b26a8cdf7ecb", // Dogsred
  "34f45c13-2b78-4900-8af2-d0bb551101f4", // Dorohedoro
  "1c5863f0-d91c-4fc8-81ee-0056af135288", // Dorondororon
  "37daf375-2987-4e39-a7dc-7f7926a19954", // Dr. Slump Remake Anime Comic
  "cfc3d743-bd89-48e2-991f-63e680cc4edf", // Dr. Stone
  "40bc649f-7b49-4645-859e-6cd94136e722", // Dragon Ball
  "910322de-9eba-41cb-aa04-bbbd9eeaac83", // Dragon Ball AF / After Future
  "e0bf46fe-740c-4897-94a1-6cba23f49433", // Dragon Ball AF Daitai no Mirai
  "e0d3f82d-ecad-40d3-bffd-5caa6b15b831", // Dragon Ball AF Toyotarou
  "d4ad9513-115e-477f-b366-d27b440261b2", // Dragon Ball AF Young Jijii
  "ac88ad5d-db2d-49fa-9b27-5e16075feac0", // Dragon Ball: An Earth Without Goku
  "fc23058f-62f0-423a-af98-4289904c3bf2", // Dragon Ball Desire
  "af0527c1-8734-4498-b128-7090340bc10d", // Dragon Ball Digital Colored Comics
  "c4fbf93f-d35f-4d5c-b1ed-3b4d85d3e0ff", // Dragon Ball Gaiden / Yamcha
  "94b3b927-eacb-4264-87bd-0a4cf79bfef3", // Dragon Ball Goku's Side Story
  "c3be71c6-014a-4bca-ba10-5137ffed90a3", // Dragon Ball GT
  "4b1a60d8-d7f0-4c6b-b64f-43a192089f34", // Dragon Ball Heroes Victory Mission
  "c62b73e5-0cfb-4aef-9425-60393477ab6c", // Dragon Ball Kakumei
  "4ec05517-cd74-4680-b1a5-3191af94cc82", // Dragon Ball Red
  "e8f801a0-cc7b-4c42-8092-f7ee96a23353", // Dragon Ball Sai Super Vegeta Den
  "37b87be0-b1f4-4507-affa-06c99ebb27f8", // Dragon Ball Super
  "f486a183-6660-492b-b94b-aa80960d8326", // Dragon Ball Super Digital Colored Comics
  "e8136b4f-b3bb-42fc-9102-35bea007be80", // Dragon Ball Super Divers
  "a389b776-2fe0-4f35-afcd-65ebc1b20c38", // Dragon Ball Super Pride of the Beast
  "4bb7eac3-da10-4873-ae04-1157dc08b22d", // Dragon Ball Tibetan Edition
  "d6115bd7-a0b5-4a37-96b3-0a4d1cd3f9a4", // Dragon Ball Z Elsewhere
  "49a5e03a-2cf1-4422-a79f-91a285bcacac", // Dragon Ball Z
  "b75a0d42-ce8c-461e-8e00-3a4863511ec3", // Shin Dragon Ball After
  "625156ef-36c0-4432-babf-a2ee57194442", // Super DB Dragon Ball AF Magazine
  "586b852c-43c4-465a-8d50-08d65c4f9795", // Super Dragon Ball Heroes Hearts
  "a81d7f35-eaca-43a8-9928-2b1b521556b2", // Super Dragon Ball Heroes Meteor Mission
  "9ee29565-b582-4486-bed5-4125b3e12844", // Super Dragon Ball Heroes Ultra God Mission
  "aa3d8c33-f6d8-4621-9bd6-cf9ff7057a27", // Touhou Dragon Ball
  "89ad8e16-ceff-47c4-adce-cc00baa65392", // DRCL Midnight Children
  "fdfa6ff7-05a3-45da-9565-9d4029b9f25c", // Earthchild
  "f53528a2-1c93-4485-b3a5-eb483693dd97", // Eisei Otome no Tatakaikata
  "f29d4785-396a-494e-b48f-47d02f583276", // Fate/stay night Unlimited Blade Works
  "57fa627a-2e61-42a2-9dd0-c558b25c99f2", // Umamusume / Fate Stay Night
  "54510496-b1d9-4b71-ac97-b50dec06d685", // Fire Emblem Engage
  "6fef1f74-a0ad-4f0d-99db-d32a7cd24098", // Fire Punch
  "c6dc99d1-4b39-4a7e-bfda-ad66fdff235f", // Firefly Wedding
  "fd3db4be-b2d0-41ab-895b-de5dc99b4f9d", // Flame of Recca
  "30f3ac69-21b6-45ad-a110-d011b7aaadaa", // Fly Me to the Moon
  "f9c9614d-0657-44c6-9c33-47fd58cd51b3", // Fullmetal Alchemist
  "73743311-2118-42eb-9af2-c64d05e97edd", // Ghost Reaper Girl
  "c59cb24f-c791-4c71-815b-52ecc3f9bb69", // Gintama 3-nen Z-gumi
  "0fb8ef3e-794a-4bdd-9d3c-6566d63a785b", // Girl Crush
  "8847f905-550d-4fe6-bcda-ac2b896789c7", // Golden Kamuy
  "738c875c-1a67-4365-862f-50ade14f8133", // Golden Kamuy Digital Colored Comics
  "4301d363-ee02-43f4-ae24-4cbf29a74830", // Goodnight Punpun
  "79dd7cb9-f078-4d64-b0b4-5599c3c3c378", // Gun Blaze West
  "eed7c921-7d8f-4684-971f-37fdf30b5600", // Haikyu Goo Doujinshi
  "f4c53742-6af4-4a05-b807-3030480062c1", // Haikyuu Doujinshi
  "e2539336-5864-4c76-a4b4-d47810064a57", // Haikyuu My Beloved Moja Hina
  "b1582971-a708-4b0b-8b95-36b28d458484", // Haikyuu DJ
  "e7ea7c7c-a0cc-4443-a5c3-95b6e49b5b84", // Haikyuu DJ
  "cb77e4a6-3921-43b9-9d64-7d78cd3205ce", // Hell's Paradise
  "174c9c71-2786-497c-8596-156911d43b36", // Hell Warden Higuma
  "87ebd557-8394-4f16-8afe-a8644e555ddc", // Hirayasumi
  "8d64bbc5-b1a7-4346-b233-4b81952945e9", // Honey and Clover
  "63fc4c1b-01f6-46a1-b2f6-97d0f10938ef", // Hoshin Engi Digital Colored Comics
  "936f0ba5-ca65-4de4-99b1-528c02a4454d", // Hunter x Hunter Digital Colored Comics
  "b1a6e98c-33c2-473e-a203-c5b1a7b541ee", // I'll Give It My All Tomorrow
  "acdbf57f-bf54-41b4-8d92-b3f3d14c852e", // I Want to End This Love Game
  "7969d025-c149-49f4-b5ba-5ffe971b4da1", // Ice Head Gill
  "99af94f5-04c2-424b-8438-0c8386b0ec5f", // Insomniacs After School
  "279c2494-8f85-4e5b-8bfb-a3223441fd13", // Inuyasha
  "3148976a-e0b0-4a9c-a1eb-58783a11ff99", // JoJo Part 2 Digital Colored Comics
  "51f7d9fc-256e-4160-add1-ab9652f32ae1", // JoJo Part 3 Digital Colored Comics
  "72d1ae71-4391-4bb2-9f39-784af3cc3c71", // JoJo Part 6 Digital Colored Comics
  "8b58f452-4d8a-4aad-a050-349e83fecccb", // Jujutsu Kaisen 0
  "c52b2ce3-7f95-469c-96b0-479524fb7a1a", // Jujutsu Kaisen
  "f3f59f12-351a-4de7-bd51-696d0764d64e", // Jujutsu Kaisen Modulo
  "0fc8f12b-a8fc-4e83-bcc8-711b1b123214", // Jujutsu Kaisen Doujinshi
  "d65c0332-3764-4c89-84bd-b1a4e7278ad7", // Kagurabachi
  "37f5cce0-8070-4ada-96e5-fa24b1bd4ff9", // Kaguya-sama Love is War
  "71763dfb-8b85-4a74-92df-dfe46478fc5d", // Kaiju No. 8 Relax
  "cc3eac46-e0d6-423d-bf0b-73e1ad59fe06", // Kekkaishi
  "7066efc8-b73f-4b17-8b8d-6060a5412590", // Kill Blue
  "7c31c29f-9130-4d63-92b9-d4990493251f", // La Corda d'Oro
  "d620c533-73ce-40a3-93d8-0d7a96768cc9", // Let's Do It Already
  "d0fc0392-ee52-46ab-a47d-c894bd91154f", // Pokemon Card Game Scarlet/Violet
  "e2c0a387-ce77-43e0-ae4f-52f60ac25fc4", // Pokemon Card Game Sun/Moon
  "87bad767-9496-4760-b598-7cd5a1ebca3b", // Pokemon Card Game XY Break
  "377e8a70-2324-43d3-8518-462554161e46", // Pokemon Colosseum Snatchers
  "2c4b353f-d968-461b-be49-4f2599189a79", // Pokemon Festival of Kings
  "a6443a84-843e-4396-85b6-fbdf20ea8930", // Pokemon Horizons
  "477f7175-4663-40f4-89a8-7d2109fbff75", // Pokemon Mystery Dungeon
  "eb9e75c9-b0d3-4b99-a455-552ae59a4da5", // Pokemon Ranger
  "fb74e93d-e947-4774-83e7-d972b85d3d11", // Pokemon Special Scarlet and Violet
  "34e48019-b261-4dd9-802d-ed9c7cb54112", // Pokemon Fancomic
  "d16348a7-b667-4496-8e0e-2b12540d86ce", // Too Many Losing Pokemon
  "2ab58332-e1ed-45eb-a717-dd4bdf380ed5", // Yoshihiro Togashi x Pokemon
  "b635888b-f3fd-4e0e-be8b-13e0d8fa8c3e", // Lucky Star
  "33b4197d-0b5a-4efc-befa-b97e28a6cc0b", // Lucky Star Lucky Point
  "ac99bb12-c788-4f7d-95c1-1264d0d943b4", // Maid to Skate
  "c8da7141-f75b-45dc-9ab0-aad412fa50c8", // March Story
  "f4397b12-137c-426f-92ff-618ddfbad51a", // Marriage Toxin
  "fe4f8d88-ea0e-4a77-814f-95d9f66bb37c", // MeruPuri
  "ce7cd7b0-e595-4f0d-98e8-447da10d652d", // Mission: Yozakura Family
  "22411384-cd93-4993-b52a-30d7af338283", // Monster Hunter Flash Hunter
  "1d9fad4e-b81a-4498-8cce-e5ddfb1e4f03", // Moriarty the Patriot
  "2443c0cf-e3e1-4305-bf57-b5c7f370781b", // Moriarty the Patriot: The Remains
  "03438804-f9b7-4748-be58-d120d5ffb8e6", // Mujina Into the Deep
  "f8130b86-4b82-4b64-a91c-1444ab770b6e", // My Hero Academia 10-B
  "88b27104-ee16-4a88-8049-430507b8e920", // My Hero Academia Doujinshi
  "1a051bb3-094e-4494-aa2e-fdac29b9ab5b", // My Hero Academia Official Colored
  "64ac1d0a-3170-4dbb-b24d-645a2f16ba8c", // Vigilante: My Hero Academia Illegals
  "456ca0b6-5b4b-4515-84bc-04c804207bf5", // Neon Genesis Evangelion
  "ca36ef36-044a-4f1c-8248-00854d4938f3", // Neru
  "3fc11571-6220-4a28-ac44-e20e8cf5daa1", // Nine Dragons Ball Parade
  "ce16b1c3-d6bb-41e0-8671-d8b065248ba2", // Nisekoi
  "77488c29-1c01-43d9-803e-e132fbb0f9b6", // No Guns Life
  "95aa6275-3a71-460b-af9f-33ee9b93bebc", // Nue's Exorcist
  "a1c7c817-4e59-43b7-9365-09675a149a6f", // One Piece
  "a2c1d849-af05-4bbc-b2a7-866ebb10331f", // One Piece Digital Colored Comics
  "470ac1ec-c3dd-4dc2-9e5d-0104600ed1a5", // One Piece Episode A
  "a0b49136-9f4d-46d4-b5dd-d5393e015009", // One Piece Party
  "b70113a5-32a3-44e8-a28f-0e88392808ba", // One Piece School
  "d8a959f7-648e-4c8d-8f23-f1f3f8e129f3", // One-Punch Man
  "29c42e49-d6f5-4084-9cec-771f5660c90f", // One-Punch Man Fan Colored
  "b7d069cb-4ab9-4c21-a20b-38f7c269be4e", // One-Punch Man Webcomic
  "79b7357c-ea5b-491a-a25b-155a804bf53f", // Otaku Vampire's Love Bite
  "661a792b-6729-4f54-af20-4108db55ccf4", // Ouran High School Host Club
  "bacb4242-4a00-4000-8386-6546ff96340e", // Palace of the Omega
  "b700777b-b007-436a-8830-951cd5e1df97", // Phantom Busters
  "b5b21ca1-bba5-4b9a-8cd1-6248f731650b", // Record of Ragnarok
  "6676aef9-cf30-4950-9a20-e0382b5e7447", // Record of Ragnarok: Apocalypse of the Gods
  "f6f3fe1c-c086-4f50-a8cf-3ec48fa3f3a8", // Record of Ragnarok: Jack the Ripper
  "4b983dce-8da1-4fdb-90e2-2326a62efedf", // Rosario Vampire Digital Colored Comics
  "eda269d8-a529-4696-a88e-1e529e4e763f", // Rosario Vampire Season 2
  "ada4b443-7a2a-4974-862e-c66f1127413b", // Rurouni Kenshin
  "bbacf021-8aff-4ea3-9668-dd59767f101b", // RWBY Official Manga Anthology
  "9d9b04ad-9a83-49f4-8ae4-a9a3780fe9c0", // Sakamoto Days
  "c3a410f3-6c1c-454c-93eb-8b995fd4cf56", // Sakamoto Days Digital Colored Comics
  "88d8271a-ed40-4874-b23f-a1ded5fc1ebf", // Sand Land
  "24a002f6-6129-4366-8fe2-5d1a8759cb46", // Sand Land Full Color
  "17ce37ea-1cda-4429-b062-c4b627814225", // Seraph of the End
  "5c02d8c1-d4a7-476f-a6ab-c5d0577dab17", // Sexy Voice and Robo
  "7e866932-b408-4ded-ae02-c1331579a4d8", // Shadow Eliminators
  "319df2e2-e6a6-4e3a-a31c-68539c140a84", // Slam Dunk
  "d84b20c0-2502-4ed6-8a3a-65448e1acd46", // Slam Dunk Shinsoban Release
  "af7cc594-4f6a-4c0a-8f74-16748910dee5", // Snow White with the Red Hair
  "708e2bed-5bc7-46c4-b9e8-a1c5d32a992a", // Spirited Away Eden
  "1d9e54a2-b00c-40a0-97d4-c651a51826d2", // The Road Home After Being Spirited Away
  "d79fdf16-153a-4a0a-95b8-c208b1162644", // Splatoon 3
  "f4904da8-2250-461b-bb29-3ec177c40bb9", // Splatoon
  "c6490cc0-443f-4c49-9273-ca3148a89b39", // Splatoon Squid Kids Comedy Show
  "efbd7ba4-c65b-49ca-873a-f8fcbdd8a7d3", // Spy x Family Doujinshi
  "004ae1de-8a05-494b-b8ff-2f3e0ef4ea89", // Spy x Family Doujinshi
  "bb790a3b-9232-4552-97c4-50040f62c960", // Sweet Reincarnation
  "162146eb-672a-4a05-b3b2-0c6303f9614e", // Takopi's Original Sin
  "cfcc577d-14a3-4332-beaa-346068d2afbd", // Tamon's B-Side
  "ce89adb4-63fc-422e-9fbc-40ea6af4525c", // Terra Formars
  "f7b62193-bdfb-4953-a6c6-0bd1b9a872f9", // The Bugle Call
  "bb8310e4-6050-4a43-984e-f7bbdfce23b1", // The Climber
  "82cea62c-e413-4f60-91c7-f1d0171c2806", // The Kingdom of the Gods
  "bc06172f-8e62-4e92-84ec-2bfbd9dab255", // The Law of Ueki
  "bb3f8e06-9049-4b3d-9654-30bf11d65338", // The Legend of Zelda: A Link to the Past
  "46e9cae5-4407-4576-9b9e-4c517ae9298e", // The Promised Neverland
  "9a901eb2-94f6-4761-97fe-de211050b344", // Red River
  "89daf9dc-075a-4aa5-873a-cc76bb287108", // The Way of the Househusband
  "6f712b54-7f0d-432a-a340-cb61a46d57d1", // This Is My Love Story
  "7231545b-39ce-4d51-a825-b905b16691a3", // Tiger & Bunny
  "f7e168e8-42f5-4ebc-b9ae-74c844a7c189", // Time Paradox Ghostwriter
  "6a1d1cb1-ecd5-40d9-89ff-9d88e40b136b", // Tokyo Ghoul
  "59f47645-66a9-443e-8228-788313c3ae3c", // Tokyo Ghoul:re
  "7e50742e-76bc-44be-b561-ac6ce1681a63", // Tokyo Ghoul Redrawn
  "df08d30e-6d53-4b40-9075-ee3404fcbf3d", // To Strip the Flesh
]);

/**
 * Checks if a given MangaDex ID is blocked due to a DMCA copyright complaint.
 */
export function isDmcaBlocked(id: string | null | undefined): boolean {
  if (!id) return false;
  return DMCA_BLOCKED_IDS.has(id.toLowerCase().trim());
}
