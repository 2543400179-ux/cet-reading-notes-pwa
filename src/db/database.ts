import Dexie, { type Table } from 'dexie';
import type {
  ReadingMaterial,
  Question,
  Note,
  Highlight,
  NoteLink,
  AiRecord,
  FolderItem,
} from '../types';

export class TidalReadingDatabase extends Dexie {
  readingMaterials!: Table<ReadingMaterial, string>;
  questions!: Table<Question, string>;
  notes!: Table<Note, string>;
  highlights!: Table<Highlight, string>;
  noteLinks!: Table<NoteLink, number>;
  aiRecords!: Table<AiRecord, string>;
  folders!: Table<FolderItem, string>;

  constructor() {
    super('TidalReadingDB');
    this.version(1).stores({
      readingMaterials: 'id, title, createTime',
      questions: 'id, materialId, answer',
      notes: 'id, title, createTime, materialId',
      highlights: 'id, materialId, startPos, endPos',
      noteLinks: '++id, sourceNoteId, targetNoteName',
      aiRecords: 'id, sourceText, createTime, noteId',
    });
    this.version(2).stores({
      readingMaterials: 'id, title, createTime, folderId, order',
      questions: 'id, materialId, answer',
      notes: 'id, title, createTime, materialId, folderId, order',
      highlights: 'id, materialId, startPos, endPos',
      noteLinks: '++id, sourceNoteId, targetNoteName',
      aiRecords: 'id, sourceText, createTime, noteId',
      folders: 'id, parentId, library, order, createdAt',
    });
  }
}

export const db = new TidalReadingDatabase();

export const INITIAL_FOLDERS: FolderItem[] = [
  {
    id: 'folder-mat-cet4',
    name: '大学英语四级真题 (CET-4)',
    parentId: null,
    library: 'materials',
    order: 0,
    createdAt: Date.now() - 300000,
  },
  {
    id: 'folder-mat-cet6',
    name: '大学英语六级真题 (CET-6)',
    parentId: null,
    library: 'materials',
    order: 1,
    createdAt: Date.now() - 200000,
  },
  {
    id: 'folder-notes-vocab',
    name: '词汇与长难句专题',
    parentId: null,
    library: 'notes',
    order: 0,
    createdAt: Date.now() - 100000,
  },
  {
    id: 'folder-notes-abstract',
    name: '核心抽象概念库',
    parentId: 'folder-notes-vocab', // Nested subfolder
    library: 'notes',
    order: 0,
    createdAt: Date.now() - 50000,
  },
];

// Preloaded authentic CET-4 & CET-6 reading passages
export const INITIAL_MATERIALS: ReadingMaterial[] = [
  {
    id: 'mat-cet4-2024-01',
    title: 'CET-4 真题精选：The Cognitive Benefits of Deep Reading in the Digital Age',
    category: 'CET-4',
    folderId: 'folder-mat-cet4',
    order: 0,
    createTime: Date.now() - 86400000 * 3,
    markdownContent: `In an era dominated by hyperlinked web pages, rapid-fire social media feeds, and persistent smartphone push notifications, the human cognitive architecture is undergoing a subtle yet profound transformation. Cognitive psychologists frequently distinguish between "skimming"—the rapid scanning of superficial keywords for immediate instrumental utility—and "deep reading", an intellectually immersive state characterized by reflective contemplation, empathetic resonance, and deductive reasoning.

When individuals engage in deep reading of complex, linear narrative prose, neuroimaging reveals extensive bilateral activation across the prefrontal cortex, hippocampus, and temporal lobes. Unlike the fractured attentional patterns induced by algorithmic news feeds, prolonged absorption in rich syntax nurtures working memory capacity and strengthens critical discernment. Readers are prompted to generate internal conceptual models, interrogating assumptions rather than merely consuming fragmented soundbites.

Nevertheless, educational researchers warn that the ubiquity of short-form digital entertainment is subtly eroding students' cognitive stamina. When confronted with dense theoretical arguments or extended analytical essays, many contemporary learners report a sensation of restless cognitive fatigue. The impulse to multitask, while intuitively perceived as efficient, actually incurs substantial cognitive switching costs that compromise substantive comprehension.

To preserve the capacity for nuanced analysis, cognitive scientists advocate for deliberate "cognitive hygiene". Establishing dedicated, screen-free reading rituals—even for twenty minutes each day—allows the brain to recalibrate its neural pathways. Ultimately, deep reading is not merely an antiquated cultural pastime; it remains the cognitive bedrock of autonomous discernment in an algorithmic society.`
  },
  {
    id: 'mat-cet6-2024-02',
    title: 'CET-6 真题精选：Urban Rewilding and Ecological Resilience in Megacities',
    category: 'CET-6',
    folderId: 'folder-mat-cet6',
    order: 0,
    createTime: Date.now() - 86400000 * 2,
    markdownContent: `As planetary urbanization accelerates, global metropolitan centers are increasingly confronted with compound ecological vulnerabilities: severe urban heat island anomalies, exacerbated flash flood risks, and catastrophic losses of indigenous biodiversity. In response, municipal planners and landscape ecologists are championing "urban rewilding"—a paradigm shift that transcends decorative ornamental horticulture in favor of reinstating self-sustaining, dynamic ecological processes within the urban fabric.

Traditional municipal landscaping historically favored manicured monoculture lawns, exotic non-native botanicals, and heavily engineered concrete floodways. While visually orderly, these artificial systems lack resilience against extreme climatological shocks and demand disproportionate inputs of potable irrigation water, chemical fertilizers, and maintenance labor. Rewilding initiatives, conversely, deliberately reintroduce native flora, restore subterranean micro-topographies, and establish contiguous biological corridors that weave through dense architectural environments.

Crucially, recent empirical investigations demonstrate that urban rewilding engenders multifaceted socio-psychological dividends alongside quantifiable ecological metrics. Exposure to structurally complex, biodiverse greenspaces is correlated with marked reductions in physiological biomarkers of chronic stress and improved attentional restoration among city residents. Furthermore, decentralized bioretention swales and permeable wetlands have proven extraordinarily efficacious in mitigating catastrophic urban stormwater inundation at a fraction of the cost required for gray-infrastructure expansion.

Inevitably, institutional friction persists. Skeptics frequently contend that spontaneous vegetation projects an impression of urban decay or municipal negligence. Overcoming these aesthetic and bureaucratic prejudices necessitates participatory community stewardship, where citizens are educated not merely as passive spectators of municipal parks, but as collaborative stewards of their living micro-habitats.`
  }
];

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q-cet4-01',
    materialId: 'mat-cet4-2024-01',
    content: 'According to Paragraph 1, what essentially distinguishes "deep reading" from "skimming"?',
    options: [
      'A. Deep reading focuses primarily on speed and keyword indexing.',
      'B. Deep reading entails empathetic resonance, contemplation, and deductive logic.',
      'C. Deep reading relies heavily on hyperlinked information architectures.',
      'D. Deep reading is uniquely practiced during digital browsing.'
    ],
    answer: 'B',
    explanation: '第1段明晰区分了“skimming”与“deep reading”：后者以“reflective contemplation, empathetic resonance, and deductive reasoning”（沉思、共情共鸣与演绎推理）为核心特征。故选B。'
  },
  {
    id: 'q-cet4-02',
    materialId: 'mat-cet4-2024-01',
    content: 'What does neuroimaging demonstrate when people engage in linear, complex prose reading?',
    options: [
      'A. Diminished cerebral circulation throughout the temporal lobes.',
      'B. An immediate impulse to seek digital multimedia stimuli.',
      'C. Broad bilateral activation across multiple critical cerebral regions.',
      'D. Severe cognitive exhaustion in the prefrontal cortex.'
    ],
    answer: 'C',
    explanation: '第2段指出“neuroimaging reveals extensive bilateral activation across the prefrontal cortex, hippocampus, and temporal lobes”，即在前额叶、海马体及颞叶出现广泛的双侧激活。故选C。'
  },
  {
    id: 'q-cet4-03',
    materialId: 'mat-cet4-2024-01',
    content: 'What is the consequence of multitasking during reading mentioned in Paragraph 3?',
    options: [
      'A. It substantially increases long-term reading efficiency.',
      'B. It generates cognitive switching penalties that damage comprehension.',
      'C. It expands the capacity of human working memory.',
      'D. It eliminates the feeling of cognitive fatigue.'
    ],
    answer: 'B',
    explanation: '第3段明确说明“The impulse to multitask... incurs substantial cognitive switching costs that compromise substantive comprehension”，即多任务切换带来高昂认知切换成本并损及实质理解。故选B。'
  },
  {
    id: 'q-cet4-04',
    materialId: 'mat-cet4-2024-01',
    content: 'What measure do cognitive scientists recommend under "cognitive hygiene"?',
    options: [
      'A. Completely avoiding printed theoretical literature.',
      'B. Substituting books with audio clips and video soundbites.',
      'C. Practicing dedicated screen-free reading rituals daily.',
      'D. Relying on algorithmic feeds to filter key arguments.'
    ],
    answer: 'C',
    explanation: '第4段提到认知科学家建议实施“cognitive hygiene”，即“Establishing dedicated, screen-free reading rituals—even for twenty minutes each day”（建立每日无屏专注阅读仪式）。故选C。'
  },
  {
    id: 'q-cet6-01',
    materialId: 'mat-cet6-2024-02',
    content: 'What core shift does "urban rewilding" represent compared to conventional landscaping?',
    options: [
      'A. Expanding monoculture lawns with synthetic aesthetic dyes.',
      'B. Restoring self-regulating natural processes rather than maintaining decorative plantings.',
      'C. Relying entirely on underground concrete drainage canals.',
      'D. Replacing all indigenous flora with fast-growing exotic species.'
    ],
    answer: 'B',
    explanation: '第1段与第2段阐述：Rewilding超越了观赏性园艺，致力于“reinstating self-sustaining, dynamic ecological processes”（恢复自生、动态的生态过程）。故选B。'
  },
  {
    id: 'q-cet6-02',
    materialId: 'mat-cet6-2024-02',
    content: 'Why are traditional manicured landscapes increasingly criticized in modern megacities?',
    options: [
      'A. They look excessively natural and lack geometric symmetry.',
      'B. They are vulnerable to climatic shocks and require excessive water and maintenance.',
      'C. They cannot be built near architectural clusters.',
      'D. They prevent municipal governments from installing concrete floodways.'
    ],
    answer: 'B',
    explanation: '第2段说明传统草坪“lack resilience against extreme climatological shocks and demand disproportionate inputs of potable irrigation water, chemical fertilizers, and maintenance labor”。故选B。'
  },
  {
    id: 'q-cet6-03',
    materialId: 'mat-cet6-2024-02',
    content: 'What psychological benefit is associated with structurally complex, biodiverse greenspaces?',
    options: [
      'A. Reduction of chronic stress biomarkers and mental restoration.',
      'B. Heightened adrenaline secretion in metropolitan residents.',
      'C. Complete immunity against infectious urban illnesses.',
      'D. An immediate preference for concrete infrastructure.'
    ],
    answer: 'A',
    explanation: '第3段指出：“Exposure to structurally complex, biodiverse greenspaces is correlated with marked reductions in physiological biomarkers of chronic stress and improved attentional restoration”。故选A。'
  }
];

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-deep-reading-lexicon',
    title: '四级高频长难句：认知架构与深度阅读',
    materialId: 'mat-cet4-2024-01',
    folderId: 'folder-notes-vocab',
    order: 0,
    anchorSnippet: 'cognitive psychologists frequently distinguish between "skimming"... and "deep reading"',
    anchorStartPos: 145,
    anchorEndPos: 236,
    createTime: Date.now() - 86400000,
    markdownContent: `## 核心语法与句型拆解

- **辨析表达**：\`distinguish between A and B\` (区分 A 与 B)
- **并列宾语结构**：
  > "an intellectually immersive state characterized by reflective contemplation, empathetic resonance, and deductive reasoning"
  - \`characterized by...\` 过去分词短语作后置定语，修饰前面的 state。
  - 三个平行名词短语并列：
    1. **reflective contemplation**（反思性深思）
    2. **empathetic resonance**（共情共鸣）
    3. **deductive reasoning**（演绎推理）

## 关联双链
- 参见词汇卡片：[[四六级核心抽象名词]]
- 句型积累：[[学术议论文因果与对比模板]]

## 备考反思
在做四六级仔细阅读时，定位词若为 *distinguish*，常对应题目中关于“差异/特征对比”的主旨细节题！`
  },
  {
    id: 'note-urban-rewilding-vocab',
    title: '六级环境生态类词汇专题',
    materialId: 'mat-cet6-2024-02',
    folderId: 'folder-notes-vocab',
    order: 1,
    anchorSnippet: 'urban rewilding—a paradigm shift that transcends decorative ornamental horticulture',
    anchorStartPos: 215,
    anchorEndPos: 308,
    createTime: Date.now() - 43200000,
    markdownContent: `## 高分六级词汇清单 (Rewilding)

1. **paradigm shift**：范式转变
2. **transcend** (v.)：超越，超出
3. **ornamental horticulture**：观赏园艺学
4. **monoculture lawns**：单一栽培草坪
5. **resilience** (n.)：弹性，复原力

## 双链网状关联
- [[四六级核心抽象名词]]
- [[六级高频动宾搭配指南]]

> "Sustainable infrastructure balances gray and green assets."`
  },
  {
    id: 'note-abstract-nouns',
    title: '四六级核心抽象名词',
    folderId: 'folder-notes-abstract',
    order: 0,
    createTime: Date.now() - 21600000,
    markdownContent: `## 四六级高频抽象概念词汇库

- **resonance** (n.) 共鸣；共振
- **resilience** (n.) 韧性；适应力
- **discernment** (n.) 洞察力；敏锐辨识
- **stamina** (n.) 耐力；毅力
- **vulnerability** (n.) 脆弱性；易受攻击性

### 引用与双链
- 见：[[四级高频长难句：认知架构与深度阅读]]
- 见：[[六级环境生态类词汇专题]]`
  }
];

export const INITIAL_HIGHLIGHTS: Highlight[] = [
  {
    id: 'hl-01',
    materialId: 'mat-cet4-2024-01',
    startPos: 145,
    endPos: 236,
    bgColor: '#FEF08A', // pastel yellow
    textColor: '#1E293B',
    text: 'distinguish between "skimming"—the rapid scanning of superficial keywords for immediate instrumental utility—and "deep reading"'
  },
  {
    id: 'hl-02',
    materialId: 'mat-cet4-2024-01',
    startPos: 400,
    endPos: 485,
    bgColor: '#BAE6FD', // pastel blue
    textColor: '#0369A1',
    text: 'extensive bilateral activation across the prefrontal cortex, hippocampus, and temporal lobes'
  }
];

export const INITIAL_NOTE_LINKS: NoteLink[] = [
  { sourceNoteId: 'note-deep-reading-lexicon', targetNoteName: '四六级核心抽象名词' },
  { sourceNoteId: 'note-deep-reading-lexicon', targetNoteName: '学术议论文因果与对比模板' },
  { sourceNoteId: 'note-urban-rewilding-vocab', targetNoteName: '四六级核心抽象名词' },
  { sourceNoteId: 'note-abstract-nouns', targetNoteName: '四级高频长难句：认知架构与深度阅读' },
  { sourceNoteId: 'note-abstract-nouns', targetNoteName: '六级环境生态类词汇专题' },
];

let initPromise: Promise<void> | null = null;

/**
 * Initialize Dexie with initial data if empty
 */
export async function initializeDatabaseIfEmpty(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const count = await db.readingMaterials.count();
      if (count === 0) {
        // Use bulkPut to ensure idempotency and prevent ConstraintError if keys already exist
        await db.folders.bulkPut(INITIAL_FOLDERS);
        await db.readingMaterials.bulkPut(INITIAL_MATERIALS);
        await db.questions.bulkPut(INITIAL_QUESTIONS);
        await db.notes.bulkPut(INITIAL_NOTES);
        await db.highlights.bulkPut(INITIAL_HIGHLIGHTS);

        const linksCount = await db.noteLinks.count();
        if (linksCount === 0) {
          await db.noteLinks.bulkAdd(INITIAL_NOTE_LINKS);
        }
      } else {
        // If upgrading from existing DB, make sure initial folders exist
        const folderCount = await db.folders.count();
        if (folderCount === 0) {
          await db.folders.bulkPut(INITIAL_FOLDERS);
        }
        // Link materials and notes to folders if they don't have one
        const materials = await db.readingMaterials.toArray();
        for (const m of materials) {
          if (!m.folderId) {
            const targetFolder = m.category === 'CET-6' ? 'folder-mat-cet6' : 'folder-mat-cet4';
            await db.readingMaterials.update(m.id, { folderId: targetFolder, order: 0 });
          }
        }
        const notes = await db.notes.toArray();
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (!n.folderId) {
            const targetFolder = n.id === 'note-abstract-nouns' ? 'folder-notes-abstract' : 'folder-notes-vocab';
            await db.notes.update(n.id, { folderId: targetFolder, order: i });
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize database:', err);
    }
  })();

  return initPromise;
}

/**
 * Export entire database as a JSON object
 */
export async function exportDatabaseToJson(): Promise<string> {
  const [folders, readingMaterials, questions, notes, highlights, noteLinks, aiRecords] =
    await Promise.all([
      db.folders.toArray(),
      db.readingMaterials.toArray(),
      db.questions.toArray(),
      db.notes.toArray(),
      db.highlights.toArray(),
      db.noteLinks.toArray(),
      db.aiRecords.toArray(),
    ]);

  const backupData = {
    version: 2,
    exportTime: new Date().toISOString(),
    data: {
      folders,
      readingMaterials,
      questions,
      notes,
      highlights,
      noteLinks,
      aiRecords,
    },
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Import database from JSON backup
 */
export async function importDatabaseFromJson(jsonString: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) throw new Error('Invalid backup format');

    const { folders, readingMaterials, questions, notes, highlights, noteLinks, aiRecords } = parsed.data;

    await db.transaction('rw', [
      db.folders,
      db.readingMaterials,
      db.questions,
      db.notes,
      db.highlights,
      db.noteLinks,
      db.aiRecords,
    ], async () => {
      if (Array.isArray(folders)) {
        await db.folders.clear();
        await db.folders.bulkPut(folders);
      }
      if (Array.isArray(readingMaterials)) {
        await db.readingMaterials.clear();
        await db.readingMaterials.bulkPut(readingMaterials);
      }
      if (Array.isArray(questions)) {
        await db.questions.clear();
        await db.questions.bulkPut(questions);
      }
      if (Array.isArray(notes)) {
        await db.notes.clear();
        await db.notes.bulkPut(notes);
      }
      if (Array.isArray(highlights)) {
        await db.highlights.clear();
        await db.highlights.bulkPut(highlights);
      }
      if (Array.isArray(noteLinks)) {
        await db.noteLinks.clear();
        await db.noteLinks.bulkAdd(noteLinks);
      }
      if (Array.isArray(aiRecords)) {
        await db.aiRecords.clear();
        await db.aiRecords.bulkPut(aiRecords);
      }
    });

    return true;
  } catch (err) {
    console.error('Failed to import database:', err);
    return false;
  }
}
// synced
