"""Run with: python3 -m unittest discover -s tests -v"""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Text(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.parts = []
        self.feed(source)

    def handle_data(self, value):
        self.parts.append(value)

    @property
    def value(self):
        return ' '.join(self.parts)


class BookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        manifest = json.loads((ROOT / 'book.json').read_text())
        cls.chapters = [chapter for part in manifest['parts']
                        for chapter in json.loads((ROOT / part).read_text())]

    def test_chapters_and_titles(self):
        self.assertEqual(len(self.chapters), 270)
        self.assertEqual(len({c['id'] for c in self.chapters}), 270)
        titles = {c['title'] for c in self.chapters}
        for title in ('دار الأرقم', 'وفاة أم المؤمنين خديجة', 'فتح حصونها وقسمة أرضها'):
            self.assertIn(title, titles)
        for chapter in self.chapters:
            self.assertNotIn('صفحة فارغة', chapter['title'])

    def test_quran_delimiters_and_citations(self):
        for chapter in self.chapters:
            with self.subTest(chapter=chapter['title']):
                text = Text(chapter['html']).value
                self.assertEqual(text.count('﴿'), text.count('﴾'))
                self.assertNotRegex(text, r'﴿[^﴾]*﴿')
                self.assertNotRegex(text, r'﴿[^﴾]*\d')
                # The sole remaining numeric pair is an explicitly named Biblical citation.
                pairs = list(re.finditer(r'\d+\s*:\s*\d+', text))
                for pair in pairs:
                    self.assertEqual(chapter['title'], 'دخول الرسول ﷺ المدينة')
                    self.assertRegex(text[max(0, pair.start() - 25):pair.end()], r'صحيفة حبقوق')
                for reference in re.findall(r'<bdi class="ayah-ref" dir="rtl">(.*?)</bdi>', chapter['html']):
                    self.assertRegex(reference, r'^\[[^\d:]+: \d+(?:–\d+)?\]$')

    def test_al_ahzab_example(self):
        chapter = next(c for c in self.chapters if c['title'] == 'غزوة الخندق ( الأحزاب)')
        self.assertIn('بصيرا﴾ <bdi class="ayah-ref" dir="rtl">[الأحزاب: 9]</bdi>', chapter['html'])
        self.assertNotIn('33: 9', chapter['text'])

    def test_source_description(self):
        index = (ROOT / 'index.html').read_text()
        self.assertIn('من كتب التاريخ الإسلامي', index)
        self.assertNotIn('من البداية والنهاية لابن كثير', index)


if __name__ == '__main__':
    unittest.main()
