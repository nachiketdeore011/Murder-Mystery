export const case001 = {
  id: 'CASE-001',
  title: 'The Midnight Murder',
  victim: 'Arvind Malhotra',
  location: 'Malhotra Mansion',
  incidentTime: '10:00 PM',
  status: 'Uninvestigated',
  briefing:
    'At 10:00 PM, caretaker Suresh Patil reported finding Arvind Malhotra unresponsive in the Study. Five people were inside Malhotra Mansion that evening. Their accounts and the records collected so far are preliminary; no sequence of events has been independently established.',
  objective:
    'Review each account, inspect the available records, and separate what is confirmed from what still needs corroboration.',
  // Illustrative travel costs in abstract units, not measured distances.
  // Each corridor is listed once; the graph builder applies the cost in both directions.
  corridorWeights: [
    { from: 'L001', to: 'L002', weight: 6 },
    { from: 'L001', to: 'L004', weight: 1 },
    { from: 'L001', to: 'L005', weight: 3 },
    { from: 'L002', to: 'L003', weight: 2 },
    { from: 'L002', to: 'L004', weight: 2 },
    { from: 'L002', to: 'L006', weight: 1 },
    { from: 'L003', to: 'L004', weight: 1 },
    { from: 'L004', to: 'L005', weight: 2 },
  ],
  suspects: [
    {
      id: 'S001',
      name: 'Rahul Malhotra',
      role: 'Heir',
      age: 27,
      initials: 'RM',
      biography:
        'Arvind’s only child, Rahul grew up at the mansion and now handles several of the family’s property decisions.',
      motive:
        'He disagreed with his father over a proposed sale of part of the estate.',
      alibi:
        'Rahul says he remained in the Main Hall from about 9:40 PM until staff called for help.',
      evidenceIds: ['E003'],
    },
    {
      id: 'S002',
      name: 'Meera Malhotra',
      role: 'Spouse',
      age: 34,
      initials: 'MM',
      biography:
        'Arvind’s spouse of eight years, Meera often hosted the family’s private dinners at the mansion.',
      motive:
        'She says recent disagreements about family finances had put pressure on their relationship.',
      alibi:
        'Meera says she was in the Kitchen requesting tea between 9:45 PM and 10:00 PM.',
      evidenceIds: ['E003', 'E005'],
    },
    {
      id: 'S003',
      name: 'Vikram Shah',
      role: 'Accountant',
      age: 41,
      initials: 'VS',
      biography:
        'Vikram has managed the Malhotra family accounts for six years and was at the mansion for a scheduled review.',
      motive:
        'Arvind had recently asked him to explain several entries in the estate ledger.',
      alibi:
        'Vikram says he left the Study around 9:35 PM and made a call from the East Corridor.',
      evidenceIds: ['E002', 'E009'],
    },
    {
      id: 'S004',
      name: 'Ananya Rao',
      role: 'Journalist',
      age: 29,
      initials: 'AR',
      biography:
        'Ananya writes for a fictional city weekly and had arranged an interview with Arvind about the family trust.',
      motive:
        'A published story about the trust could affect the family’s public standing.',
      alibi:
        'Ananya says she was in the Library preparing interview questions from 9:30 PM onward.',
      evidenceIds: ['E010'],
    },
    {
      id: 'S005',
      name: 'Suresh Patil',
      role: 'Caretaker',
      age: 52,
      initials: 'SP',
      biography:
        'Suresh has cared for Malhotra Mansion for fourteen years and keeps its routine maintenance records.',
      motive:
        'He was concerned that renovations might reduce his responsibilities at the estate.',
      alibi:
        'Suresh says he was checking the Garden lanterns shortly before reporting the incident.',
      evidenceIds: ['E001', 'E006', 'E008', 'E012'],
    },
  ],
  locations: [
    {
      id: 'L001',
      name: 'Study',
      description:
        'Arvind’s private workroom, with a writing desk and a direct door to the East Corridor.',
      evidenceIds: ['E001', 'E002'],
      connectedLocationIds: ['L002', 'L004', 'L005'],
    },
    {
      id: 'L002',
      name: 'Main Hall',
      description:
        'The central gathering space connecting the mansion’s public rooms and the Garden doors.',
      evidenceIds: ['E003', 'E004'],
      connectedLocationIds: ['L001', 'L003', 'L004', 'L006'],
    },
    {
      id: 'L003',
      name: 'Kitchen',
      description:
        'A working kitchen beside the service passage and the western end of the East Corridor.',
      evidenceIds: ['E005', 'E006'],
      connectedLocationIds: ['L002', 'L004'],
    },
    {
      id: 'L004',
      name: 'East Corridor',
      description:
        'A long passage linking the Study, Main Hall, Kitchen, and Library.',
      evidenceIds: ['E007', 'E008'],
      connectedLocationIds: ['L001', 'L002', 'L003', 'L005'],
    },
    {
      id: 'L005',
      name: 'Library',
      description:
        'A quiet reading room connected to the Study and the East Corridor.',
      evidenceIds: ['E009', 'E010'],
      connectedLocationIds: ['L001', 'L004'],
    },
    {
      id: 'L006',
      name: 'Garden',
      description:
        'The walled grounds outside the Main Hall, with a path to the front gate and several lanterns.',
      evidenceIds: ['E011', 'E012'],
      connectedLocationIds: ['L002'],
    },
  ],
  evidence: [
    {
      id: 'E001',
      title: 'Study key checkout sheet',
      category: 'Document',
      description:
        'A carbon duplicate records a Study key checked out at 9:18 PM. The faint initials resemble S.P. on maintenance logs, but they are not clear enough for certain attribution.',
      discoveredAt: 'L001',
      discovered: false,
      relatedSuspectIds: ['S005'],
      timestamp: '9:18 PM',
      reliability: 'medium',
      relevance:
        'The entry may connect a key checkout to Suresh, but the initials are uncertain and do not establish who had the key later.',
    },
    {
      id: 'E002',
      title: 'Ledger review page',
      category: 'Document',
      description:
        'A copied ledger page has a margin note asking for several estate expenses to be reviewed the following morning.',
      discoveredAt: 'L001',
      discovered: false,
      relatedSuspectIds: ['S003'],
      timestamp: '8:55 PM',
      reliability: 'medium',
      relevance:
        'It provides context for the planned account review, but the copied page does not establish who wrote the note.',
    },
    {
      id: 'E003',
      title: 'Main Hall CCTV stills',
      category: 'Digital record',
      description:
        'Two still images place Rahul and Meera in the Main Hall at 9:41 PM. The images cover only that moment, not their later movements.',
      discoveredAt: 'L002',
      discovered: false,
      relatedSuspectIds: ['S001', 'S002'],
      timestamp: '9:41 PM',
      reliability: 'medium',
      relevance:
        'The stills can be compared with the stated alibis, while their limited time coverage should be kept in mind.',
    },
    {
      id: 'E004',
      title: 'Staff note about raised voices',
      category: 'Witness statement',
      description:
        'An unsigned staff note recalls raised voices near the Study at about 9:35 PM but does not identify the speakers.',
      discoveredAt: 'L002',
      discovered: false,
      relatedSuspectIds: [],
      timestamp: '9:35 PM',
      reliability: 'low',
      relevance:
        'This unverified account may help frame follow-up questions, but it cannot connect the voices to a particular person.',
    },
    {
      id: 'E005',
      title: 'Tea service chit',
      category: 'Document',
      description:
        'A folded kitchen chit records a tea request for the Study at 9:48 PM; the initials in the receipt box are not legible.',
      discoveredAt: 'L003',
      discovered: false,
      relatedSuspectIds: ['S002'],
      timestamp: '9:48 PM',
      reliability: 'low',
      relevance:
        'The chit can be compared with Meera’s account, but its unclear receipt mark does not identify who delivered the tea.',
    },
    {
      id: 'E006',
      title: 'Kitchen service rota',
      category: 'Document',
      description:
        'The rota lists Suresh on kitchen service until 10:00 PM, though a shift assignment does not confirm where he was at a specific moment.',
      discoveredAt: 'L003',
      discovered: false,
      relatedSuspectIds: ['S005'],
      timestamp: null,
      reliability: 'high',
      relevance:
        'It confirms the planned duty schedule and gives context for Suresh’s movements, but not his whereabouts.',
    },
    {
      id: 'E007',
      title: 'Stopped corridor clock',
      category: 'Physical item',
      description:
        'The East Corridor clock was found showing 9:51 PM. No maintenance record establishes when it stopped.',
      discoveredAt: 'L004',
      discovered: false,
      relatedSuspectIds: [],
      timestamp: '9:51 PM',
      reliability: 'low',
      relevance:
        'The displayed time is not a reliable event timestamp unless the clock’s condition can be independently established.',
    },
    {
      id: 'E008',
      title: 'Mansion switchboard log',
      category: 'Digital record',
      description:
        'The switchboard log records an unanswered call to the Study extension at 9:57 PM. A routing copy traces it to the Garden service handset assigned to the caretaker post; the handset could be shared, so the caller is unknown.',
      discoveredAt: 'L004',
      discovered: false,
      relatedSuspectIds: ['S005'],
      timestamp: '9:57 PM',
      reliability: 'medium',
      relevance:
        'It links the call to a handset assigned to the caretaker post, but does not identify the caller or explain why the Study extension went unanswered.',
    },
    {
      id: 'E009',
      title: 'Unsigned note about the accounts',
      category: 'Document',
      description:
        'A note found among library papers asks for an account discrepancy to be reviewed the next day. It has no signature.',
      discoveredAt: 'L005',
      discovered: false,
      relatedSuspectIds: ['S003'],
      timestamp: null,
      reliability: 'low',
      relevance:
        'Its subject overlaps with the scheduled ledger review, but its author and exact purpose remain unknown.',
    },
    {
      id: 'E010',
      title: 'Interview appointment slip',
      category: 'Document',
      description:
        'An appointment slip lists Ananya’s interview with Arvind for 9:30 PM. It does not confirm that the interview took place.',
      discoveredAt: 'L005',
      discovered: false,
      relatedSuspectIds: ['S004'],
      timestamp: '9:30 PM',
      reliability: 'medium',
      relevance:
        'It supports the reason Ananya was invited to the mansion, while leaving her later movements unverified.',
    },
    {
      id: 'E011',
      title: 'Overlapping garden shoe impressions',
      category: 'Physical item',
      description:
        'Two partial shoe impressions overlap on the Garden path. The marks are too incomplete to identify a person or shoe size.',
      discoveredAt: 'L006',
      discovered: false,
      relatedSuspectIds: [],
      timestamp: null,
      reliability: 'low',
      relevance:
        'The impressions suggest recent foot traffic, but cannot be attributed to any suspect from the available record.',
    },
    {
      id: 'E012',
      title: 'Garden lantern maintenance card',
      category: 'Document',
      description:
        'A maintenance card signed by Suresh records a lantern wick replacement at 9:44 PM. A carbon copy shows that the time was entered at 10:12 PM, after the incident was reported, so it cannot independently place him in the Garden at 9:44.',
      discoveredAt: 'L006',
      discovered: false,
      relatedSuspectIds: ['S005'],
      timestamp: '9:44 PM',
      reliability: 'low',
      relevance:
        'The later entry time weakens the card as a timestamp for Suresh’s Garden account; it does not establish who performed the maintenance or what happened in the Study.',
    },
  ],
  events: [
    {
      id: 'T001',
      timestamp: '9:05 PM',
      title: 'Dinner service began',
      description:
        'The household dinner was reported to have begun in the Main Hall.',
      relatedSuspectIds: ['S001', 'S002', 'S003', 'S004', 'S005'],
      locationId: 'L002',
      confirmed: true,
    },
    {
      id: 'T002',
      timestamp: '9:22 PM',
      title: 'Account review requested',
      description:
        'Vikram says Arvind asked him to return to the Study to discuss the estate accounts.',
      relatedSuspectIds: ['S003'],
      locationId: 'L001',
      confirmed: false,
    },
    {
      id: 'T003',
      timestamp: '9:35 PM',
      title: 'Ananya’s reported move to the Library',
      description:
        'Ananya says she left the Main Hall to prepare questions in the Library.',
      relatedSuspectIds: ['S004'],
      locationId: 'L005',
      confirmed: false,
    },
    {
      id: 'T004',
      timestamp: '9:43 PM',
      title: 'East Corridor camera interruption',
      description:
        'The system log records a fourteen-second gap in the East Corridor camera feed; it does not identify a person or movement.',
      relatedSuspectIds: [],
      locationId: 'L004',
      confirmed: true,
    },
    {
      id: 'T005',
      timestamp: '9:48 PM',
      title: 'Tea requested for the Study',
      description:
        'Meera says she requested tea in the Kitchen shortly before the reported incident.',
      relatedSuspectIds: ['S002'],
      locationId: 'L003',
      confirmed: false,
    },
    {
      id: 'T006',
      timestamp: '10:00 PM',
      title: 'Incident reported',
      description:
        'Suresh says he found Arvind unresponsive in the Study and reported it at about 10:00 PM.',
      relatedSuspectIds: ['S005'],
      locationId: 'L001',
      confirmed: false,
    },
    {
      id: 'T007',
      timestamp: '10:08 PM',
      title: 'Call for assistance',
      description:
        'Rahul says he asked staff to contact the authorities from the Main Hall.',
      relatedSuspectIds: ['S001'],
      locationId: 'L002',
      confirmed: false,
    },
    {
      id: 'T008',
      timestamp: '10:24 PM',
      title: 'Arrival entered in the gate register',
      description:
        'The Garden gate register contains an entry for the arrival of local authorities.',
      relatedSuspectIds: [],
      locationId: 'L006',
      confirmed: true,
    },
  ],
}
