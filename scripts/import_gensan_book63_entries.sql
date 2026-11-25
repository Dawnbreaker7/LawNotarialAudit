-- Import transcribed Notarial Register entries from E:\Entry for Law Project
-- Branch: GENSAN (GenSan Branch)
-- Book: Book No. 63, Series of 2026 (Atty. Venchito M. Bangayan, General Santos City)
-- Source: 21 scanned pages (Pages 4-10, 16-19, 24-28, 30-31, 33, 37-38) -> 104 filled entries
-- Note: Entry 165 on Page 33 is completely blank in the physical register and is omitted.
-- Note: "TYPE OF NOTARIAL ACT" and "COMPETENT EVIDENCE OF IDENTITY" were blank on the physical pages;
--       standard Philippine notarial act types ('Jurat' / 'Acknowledgment') are assigned below.

BEGIN;

WITH target_book AS (
  SELECT b.id AS branch_id, nb.id AS book_id
  FROM public.branches b
  JOIN public.notarial_books nb ON nb.branch_id = b.id
  WHERE b.branch_code = 'GENSAN'
    AND nb.book_no = 63
    AND nb.series_year = 2026
  LIMIT 1
),
source_entries (
  page_no,
  entry_number,
  instrument_title,
  parties,
  witnesses,
  competent_evidence_id,
  notarized_at,
  notarial_act_type,
  fee_amount,
  amount_paid,
  acknowledgement_receipt,
  place_and_remarks
) AS (
  VALUES
    -- =========================================================================
    -- PAGE 4 (Entries 16-20)
    -- =========================================================================
    (4,  16, 'VERIFICATION', 'ANNA KRISTIN A. ALSONERA', NULL::text, '', '2026-10-20 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL::text, 'Fees & O.R. No. column: ALSONERA'),
    (4,  17, 'SPECIAL POWER OF ATTORNEY', 'MYRA M. WATAMAMA', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Acknowledgment', 500.00, 500.00, NULL, NULL),
    (4,  18, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (4,  19, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),
    (4,  20, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),

    -- =========================================================================
    -- PAGE 5 (Entries 21-25)
    -- =========================================================================
    (5,  21, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (5,  22, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),
    (5,  23, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),
    (5,  24, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),
    (5,  25, 'AFFIDAVIT OF PUBLICATION', 'ISAIAS L. GOLEZ SR.', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),

    -- =========================================================================
    -- PAGE 6 (Entries 26-30)
    -- =========================================================================
    (6,  26, 'ABSOLUTE TRANSFER OF RIGHTS', 'MEL', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Date blank in physical register (between Oct 21 and Oct 27, 2026)'),
    (6,  27, 'Publication', 'Golez', NULL, '', '2026-10-21 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Date blank in physical register (between Oct 21 and Oct 27, 2026)'),
    (6,  28, 'AFFIDAVIT OF LOSS', 'JAN N. MASONG', NULL, '', '2026-10-27 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (6,  29, 'OMNIBUS', 'MARYCHIL S. FAELNAR', NULL, '', '2026-10-27 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Date blank in physical register (between Oct 27 and Oct 28, 2026)'),
    (6,  30, 'AOL', 'DEAH ALBESO', NULL, '', '2026-10-28 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 7 (Entries 31-35)
    -- =========================================================================
    (7,  31, 'SPA', 'ELVIE B. BAGWEL', NULL, '', '2026-10-28 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (7,  32, 'REQUEST FOR ASSISTANCE', 'CANO, LEYNIT B.', NULL, '', '2026-10-28 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (7,  33, 'DECLARATION OF NO PENDING CASE', 'LEYNIT B. CANO', NULL, '', '2026-10-28 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (7,  34, 'DOS', 'SARINA MALADIA PIANG', NULL, '', '2026-10-29 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (7,  35, 'CHATTEL MORTGAGE AGREEMENT', E'JENELYN S. NELMIDA\nROBERT JOHN A. GAUNTAO', NULL, '', '2026-10-30 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 8 (Entries 36-40)
    -- =========================================================================
    (8,  36, 'AOL', 'LOUNNETTE JAVIER', NULL, '', '2026-10-30 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (8,  37, 'AOL', 'ANN MARIE A. ANUNG', NULL, '', '2026-10-30 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (8,  38, 'AOL', 'SALENDAB AILADIN L.', NULL, '', '2026-10-31 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (8,  39, 'AFFIDAVIT OF LOSS', 'affidavit of loss', NULL, '', '2026-10-31 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Party name missing ("affidavit of loss" written in Parties column); date blank in physical register'),
    (8,  40, 'AFFIDAVIT OF PARENT CONSENT', 'ELMA M. REMOLINO', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 9 (Entries 41-45)
    -- =========================================================================
    (9,  41, 'INVENTORY REPORT', 'IMELDA TAN', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (9,  42, 'INVENTORY REPORT', 'JESSA MAE JULIAR', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (9,  43, 'INVENTORY REPORT', 'ALLYN GRACE T. BARTOLOME', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (9,  44, 'INVENTORY REPORT', E'MEYAT DAGUM\nJULIE ANN T. RADOMES', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (9,  45, 'INVENTORY REPORT', E'CLAIRE VENNIE G. ARLINPOL\nANTONETTE C. ERA', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 10 (Entries 46-50)
    -- =========================================================================
    (10, 46, 'SPA', 'MIGUELITO CARBALLO', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (10, 47, 'AFF. OF CERTIFICATE OF EMPLOYMENT', 'GWYNETH A. ESPIRITU', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (10, 48, 'WAIVER OF RIGHTS', 'Rosita A. Raza', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (10, 49, 'Aff of Loss', 'Angel Pandoy', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (10, 50, 'Aff of Merit', 'Venchito M. Bangayan', NULL, '', '2026-11-03 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 16 (Entries 76-80)
    -- =========================================================================
    (16, 76, 'Aff of Loss', 'Nemesio S. Ranque Jr.', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (16, 77, 'DOS of Motor', E'Mark Cyril Abellon\nFebie A. Reyes', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (16, 78, 'Aff of Loss', 'Phoebe Vera Abellon', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (16, 79, 'AFFIDAVIT OF KINSHIP', 'Ronald G. Tasa', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Fees & O.R. No. column: TABA'),
    (16, 80, 'Partnership Resolution', 'Salvador F. Floro', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 17 (Entries 81-85)
    -- =========================================================================
    (17, 81, 'OMNIBUS', 'Guiness Lenh Salaysay', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (17, 82, 'AFFIDAVIT OF WITNESS', 'John Rey Dela Cruz', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (17, 83, 'AFFIDAVIT OF WITNESS', 'Isaac A. Gomez', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (17, 84, 'AFFIDAVIT OF WITNESS', 'Argie A. Grate', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (17, 85, 'Verification And Certification', 'Jose Leozaldy B. Ducayo', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 18 (Entries 86-90)
    -- =========================================================================
    (18, 86, 'SPA', 'Jenelyn S. Nelmida', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (18, 87, 'CONTRACT OF LEASE', 'JENELYN S. NELMIDA', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (18, 88, 'SPA', 'Jenelyn S. Nelmida', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (18, 89, 'Aff. of Support And Guarantee', 'Myra Joy G. Maduramente', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (18, 90, 'AFFIDAVIT OF UNDERTAKING', 'LILIA BALUME', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Fees & O.R. No. column: TABA'),

    -- =========================================================================
    -- PAGE 19 (Entries 91-95; physical row 5 was misnumbered "93", corrected to 95)
    -- =========================================================================
    (19, 91, 'Secretary''s Certificate', 'Michael Bren M. Evangelio', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, 'Date blank in physical register (estimated 2026-11-04)'),
    (19, 92, 'Verification And Certification', 'Randy M. Omega', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Alsonera; date blank in physical register (estimated 2026-11-04)'),
    (19, 93, 'Waiver of Appearance', 'Monique Norlyn Gardonia Gemino', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Date blank in physical register (estimated 2026-11-04)'),
    (19, 94, 'Additional Undertaking of Cash Bailbond', 'Monique Norlyn Gardonia Gemino', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Date blank in physical register (estimated 2026-11-04)'),
    (19, 95, 'Certificate of Completion', 'Mark Loue L. Zabala', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Mislabeled "93" in physical register (corrected to 95); date blank in physical register (estimated 2026-11-04)'),

    -- =========================================================================
    -- PAGE 24 (Entries 116-120)
    -- =========================================================================
    (24, 116, 'DEED OF ASSUMPTION OF FINANCING OBLIGATION AND CONDITIONAL TRANSFER OF RIGHTS AND INTEREST', E'ARGEL Y. LARONA\nJONATHAN DIESTRO\nRUBEN T. TACADAO', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Harvey'),
    (24, 117, 'HOUSE RENTAL AGREEMENT', E'Marck Anthony Escobido\nRhea Suan', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (24, 118, 'SPA', E'Hermelina S. Caballero\nArnold Salaan Caballero', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Harvey'),
    (24, 119, 'Secretary''s Certificate', 'Glenda G. Lacera', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (24, 120, 'SPA', 'Larina S. Nelmida', NULL, '', '2026-11-04 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 25 (Entries 121-125)
    -- =========================================================================
    (25, 121, 'COUNTER AFFIDAVIT', 'ROGENE AGOR', NULL, '', '2026-11-05 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (25, 122, 'COL', 'Cyril P. Polines', NULL, '', '2026-11-05 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (25, 123, 'LETTER OF CANCELLATION', 'Ladimir Ian G. Maduramente', NULL, '', '2026-11-05 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (25, 124, 'Secretary''s Certificate', 'Ladimir Ian G. Maduramente', NULL, '', '2026-11-05 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (25, 125, 'Corporate Secretary', 'Ladimir Ian G. Maduramente', NULL, '', '2026-11-05 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 26 (Entries 126-130)
    -- =========================================================================
    (26, 126, 'Subscription Agreement', 'Gabrielle Mae T. Maduramente', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 300.00, 300.00, NULL, NULL),
    (26, 127, 'Subscription Agreement', 'Glorianne T. Maduramente', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 300.00, 300.00, NULL, NULL),
    (26, 128, 'Secretary''s Certification', 'Mark Oliver Maduramente', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (26, 129, 'Secretary Certification', 'Mark Oliver G. Maduramente', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (26, 130, 'Secretary Certification', 'Mark Oliver G. Maduramente', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 27 (Entries 131-135)
    -- =========================================================================
    (27, 131, 'Secretary''s Certificate', 'Dennis G. De Guzman', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (27, 132, 'Letter of Cancelation', 'Dennis G. De Guzman', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 150.00, 150.00, NULL, NULL),
    (27, 133, 'OMNIBUS', 'Elenor Y. Raza', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Jurat', 300.00, 300.00, NULL, NULL),
    (27, 134, 'Aff. of Loss', 'Shyrel C. Asparo', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Jurat', 150.00, 150.00, NULL, NULL),
    (27, 135, 'Receipt and Release', 'Donnie Angelo N. Tadena', NULL, '', '2026-11-06 09:00:00+08'::timestamptz, 'Acknowledgment', 300.00, 300.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 28 (Entries 136-140)
    -- =========================================================================
    (28, 136, 'Aff. of Loss', 'DIOMEDISA L. MAGDAY', NULL, '', '2026-11-09 09:00:00+08'::timestamptz, 'Jurat', 200.00, 200.00, NULL, NULL),
    (28, 137, 'Undertaking And Waiver of Appearance', 'Monique Norlyn Gardonia Gemino', NULL, '', '2026-11-09 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (28, 138, 'Aff. of Loss', 'Lisette B. Margen', NULL, '', '2026-11-09 09:00:00+08'::timestamptz, 'Jurat', 150.00, 150.00, NULL, NULL),
    (28, 139, 'Aff. of Loss', 'Roderick D. Margen', NULL, '', '2026-11-09 09:00:00+08'::timestamptz, 'Jurat', 150.00, 150.00, NULL, NULL),
    (28, 140, 'Indemnity Agreement', 'John Tomakin', NULL, '', '2026-11-09 09:00:00+08'::timestamptz, 'Acknowledgment', 300.00, 300.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 30 (Entries 146-150)
    -- =========================================================================
    (30, 146, 'Sworn Affidavit Statement of the Secretary', 'Jeniffer L. Gemino', NULL, '', '2026-11-10 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (30, 147, 'Waiver of Appearance', 'Monique N. Gemino', NULL, '', '2026-11-10 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (30, 148, 'Additional Undertaking of Cash Bail Bond', 'Monique N. Gemino', NULL, '', '2026-11-10 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (30, 149, 'Deed of Waiver, Quitclaim and Transfer of Rights', E'Ismael L. Cebritas\nJudit C. Orquiza', NULL, '', '2026-11-10 09:00:00+08'::timestamptz, 'Acknowledgment', 1000.00, 1000.00, NULL, NULL),
    (30, 150, 'Aff of Loss', 'Andrew V. Campado', NULL, '', '2026-11-10 09:00:00+08'::timestamptz, 'Jurat', 150.00, 150.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 31 (Entries 151-155)
    -- =========================================================================
    (31, 151, 'Aff. of Loss', 'Michael Patrick Esponda Jr.', NULL, '', '2026-11-12 09:00:00+08'::timestamptz, 'Jurat', 150.00, 150.00, NULL, NULL),
    (31, 152, 'Partnership Resolution', 'Salvador F. Floro', NULL, '', '2026-11-13 09:00:00+08'::timestamptz, 'Acknowledgment', 200.00, 200.00, NULL, NULL),
    (31, 153, 'Partnership Resolution', 'Joyce G. Floro', NULL, '', '2026-11-13 09:00:00+08'::timestamptz, 'Acknowledgment', 200.00, 200.00, NULL, NULL),
    (31, 154, 'Partnership Resolution', 'Salvador F. Floro', NULL, '', '2026-11-13 09:00:00+08'::timestamptz, 'Acknowledgment', 200.00, 200.00, NULL, NULL),
    (31, 155, 'Partnership Resolution', 'Joyce G. Floro', NULL, '', '2026-11-13 09:00:00+08'::timestamptz, 'Acknowledgment', 200.00, 200.00, NULL, NULL),

    -- =========================================================================
    -- PAGE 33 (Entries 161-164; Entry 165 is blank on the physical page)
    -- =========================================================================
    (33, 161, 'Aff of Loss', 'Efren de Vera Ramirez', NULL, '', '2026-11-25 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, NULL),
    (33, 162, 'Contract to Sell', E'Remus Pardillo De Claro\nFate Pearl J. Jaranilla\nAlejandro Turtura Fabia Jr.', NULL, '', '2026-11-25 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, NULL),
    (33, 163, 'Contract to Sell', E'Remus Pardillo De Claro\nDiwata Jane A. Grancillo\nAlejandro Turtura Fabia Jr.', NULL, '', '2026-11-25 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),
    (33, 164, 'Contract to Sell', E'Remus Pardillo De Claro\nAna Patricia Bangoran\nAlejandro Turtura Fabia Jr.', NULL, '', '2026-11-25 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) in physical register'),

    -- =========================================================================
    -- PAGE 37 (Entries 181-185)
    -- =========================================================================
    (37, 181, 'SPA', E'EDUARDO BANTILAN\nJovit Bitgue', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 500.00, 500.00, NULL, NULL),
    (37, 182, 'Contract to Sale', E'Remus Pardillo De Claro\nCIRILA S. CAWIT', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Capt. Declaro'),
    (37, 183, 'Contract to Sale', E'Remus Pardillo De Claro\nEFREN H. EMBRADO', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) for Title and Fees (Capt. Declaro); partial "CIRILA S." abandoned on line 2'),
    (37, 184, 'Contract to Sale', E'Remus Pardillo De Claro\nLOUIE L. BAS', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) for Title and Fees (Capt. Declaro)'),
    (37, 185, 'Contract to Sale', E'Remus Pardillo De Claro\nJessil Babe V. Rodemio', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) for Title and Fees (Capt. Declaro)'),

    -- =========================================================================
    -- PAGE 38 (Entries 186-190)
    -- =========================================================================
    (38, 186, 'Contract to Sale', E'Remus Pardillo De Claro\nFernandes L. Baylo-on Jr.', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Capt. Declaro'),
    (38, 187, 'Contract to Sale', E'Remus Pardillo De Claro\nAngelito L. Bayloon', NULL, '', '2026-11-23 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Ditto (-do-) for Title and Fees (Capt. Declaro)'),
    (38, 188, 'AFFIDAVIT OF Non Enrollment of Spouse', 'Rolnaice Baclig', NULL, '', '2026-11-24 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Fees & O.R. No. column: Siangco'),
    (38, 189, 'AFFIDAVIT OF Non Enrollment of Spouse', 'Mae S. Pabalate', NULL, '', '2026-11-24 09:00:00+08'::timestamptz, 'Jurat', 0.00, 0.00, NULL, 'Ditto (-do-) for Title; Fees & O.R. No. column: Siangco'),
    (38, 190, 'Notary BDO Life', 'James Jay Buenafe', NULL, '', '2026-11-24 09:00:00+08'::timestamptz, 'Acknowledgment', 0.00, 0.00, NULL, 'Date blank in physical register (estimated 2026-11-24)')
)
INSERT INTO public.notarial_entries (
  book_id,
  branch_id,
  page_no,
  entry_number,
  instrument_title,
  parties,
  witnesses,
  competent_evidence_id,
  notarized_at,
  notarial_act_type,
  fee_amount,
  amount_paid,
  acknowledgement_receipt,
  place_and_remarks,
  review_status,
  attachments
)
SELECT
  tb.book_id,
  tb.branch_id,
  s.page_no,
  s.entry_number,
  s.instrument_title,
  s.parties,
  s.witnesses,
  s.competent_evidence_id,
  s.notarized_at,
  s.notarial_act_type,
  s.fee_amount,
  s.amount_paid,
  s.acknowledgement_receipt,
  s.place_and_remarks,
  'for_review',
  '[]'::jsonb
FROM source_entries s
CROSS JOIN target_book tb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notarial_entries ne
  WHERE ne.book_id = tb.book_id
    AND ne.entry_number = s.entry_number
);

COMMIT;
