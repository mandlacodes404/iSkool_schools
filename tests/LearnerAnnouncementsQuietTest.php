<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "quiet list" on the learner phone Announcements page: a title with a counts line, a search box, filter
 * chips, then a plain label for each sender with a bell, a title and one line of detail per row; and the announcement
 * detail screen in the same look as the assignment detail. The phone list now shows which announcements are unread (an
 * orange bell with a dot, a heavier title and the word "Unread"), using the same read list the desktop pane keeps, and
 * opening an announcement on a phone reads it. Everything uses the weights the phone pages already had (400 for text,
 * 600 for titles and names), so nothing in this look is 700 or heavier. Desktop (900px and up) keeps its own layout.
 * How it looks was checked by eye in a phone-sized browser with the real script and stylesheet (dark and light, 320 to
 * 430px wide, long titles, edited announcements, search, every filter, folding, opening, marking read and unread, and the
 * empty states); these read the sources so the things a later edit could quietly undo stay put.
 */
final class LearnerAnnouncementsQuietTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** The text from $start up to the first $end after it */
    private function between(string $text, string $start, string $end): string
    {
        $a = strpos($text, $start);
        $this->assertNotFalse($a, "'$start' not found");
        $b = strpos($text, $end, $a);
        $this->assertNotFalse($b, "'$end' not found after '$start'");
        return substr($text, $a, $b - $a);
    }

    private function js(): string
    {
        return $this->source('assets/js/learner/announcements.js');
    }

    private function css(): string
    {
        return $this->source('assets/css/learner/announcements.css');
    }

    /** The phone list, detail and their empty states in announcements.css (up to the shared utilities and the detail's end) */
    private function phoneCss(): string
    {
        $css = $this->css();
        $list = $this->between($css, '/* ── MOBILE LIST: the quiet list', '/* ── SHARED UTILITIES ── */');
        $detail = $this->between($css, '/* ── MOBILE: ANNOUNCEMENT DETAIL VIEW ── */', '/* Highlighted new/changed words');
        return $list . $detail;
    }

    // ── weights and colours ──────────────────────────────────────────────────────────────────────

    public function test_nothing_in_the_phone_list_or_detail_is_heavier_than_600(): void
    {
        $css = $this->phoneCss();
        preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
        $this->assertStringNotContainsString('#a78bfa', $css, 'no purple on the phone pages');
    }

    public function test_the_old_card_avatar_and_edited_tag_markup_is_gone(): void
    {
        $js = $this->js();
        foreach (['lan-mobile-card', 'lan-mobile-detail-avatar', 'lan-mobile-detail-author-row', 'lan-edited-tag', 'lan-edited-meta', 'lan-mobile-folder-icon'] as $old) {
            $this->assertStringNotContainsString($old, $js, "$old is still in announcements.js");
            $this->assertStringNotContainsString($old, $this->css(), "$old is still in announcements.css");
        }
    }

    // ── the list ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_list_has_a_title_counts_search_and_four_filters(): void
    {
        $js = $this->js();
        $this->assertStringContainsString('<h1 class="lan-mobile-title">Announcements</h1>', $js);
        $this->assertStringContainsString("'All caught up'", $js);
        $this->assertStringContainsString('${unread} unread</b> · ${total} in all', $js);
        // the same four filters the desktop list has
        foreach (["['all', 'All']", "['unread', 'Unread']", "['school', 'School-wide']", "['teacher', 'Teachers']"] as $chip) {
            $this->assertStringContainsString($chip, $js);
        }
        $this->assertStringContainsString('oninput="lanMobileSearch(this.value)"', $js);
        $this->assertStringContainsString("onclick=\"lanMobileSetFilter('\${k}')\"", $js);
        // 16px in the box stops iOS zooming the page when it is focused
        $this->assertStringContainsString('font-size: 16px; /* 16px stops iOS zooming', $this->css());
    }

    public function test_the_head_and_search_are_drawn_for_the_empty_list_too(): void
    {
        $js = $this->js();
        $empty = $this->between($js, '<!-- ═══ MOBILE EMPTY ═══ -->', '</div>`;');
        $this->assertStringContainsString("\${lanMobileHeadHtml('', false)}", $empty);
        $this->assertStringContainsString('${lanMobileSearchHtml()}', $empty);
        $this->assertStringContainsString('No announcements yet', $empty);
    }

    public function test_each_row_carries_its_kind_and_read_state_for_the_filters(): void
    {
        $js = $this->js();
        $row = $this->between($js, 'function lanMobileRowHtml(', '</svg>');
        $this->assertStringContainsString('data-idx="${idx}" data-kind="${kind}" data-state="${unread ? \'unread\' : \'read\'}"', $row);
        $this->assertStringContainsString("onclick=\"openMobileLearnerAnnouncement(\${idx})\"", $row);
        // the state is also said in words, not only in colour
        $meta = $this->between($js, 'function lanMobileMeta(', "\nfunction");
        $this->assertStringContainsString('>Unread</span>', $meta);
        $this->assertStringContainsString("'Edited'", $meta);
        // the bell draws in currentColor, so light mode needs no rule of its own for it
        $this->assertStringContainsString('.lan-mobile-row-icon--unread { color: var(--qm-new); }', $this->css());
    }

    public function test_the_bell_sits_in_the_same_soft_tile_as_the_resources_and_syllabus_rows(): void
    {
        $css = $this->css();
        // 40px tile, 12px corners, the soft surface colour, the bell centred at 20px
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon \{[^}]*width: 40px;[^}]*height: 40px;/s', $css);
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon \{[^}]*border-radius: 12px;/s', $css);
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon \{[^}]*background: var\(--qm-surf\);/s', $css);
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon \{[^}]*align-items: center;[^}]*justify-content: center;/s', $css);
        $this->assertStringContainsString('.lan-mobile-row-icon svg { width: 20px; height: 20px; }', $css);
        // 20px inset + 40px tile + 14px gap = 74px, so the hairline starts under the title, not under the tile
        $this->assertMatchesRegularExpression('/\.lan-mobile-row::before \{[^}]*left: 74px;/s', $css);
        $this->assertDoesNotMatchRegularExpression('/\.lan-mobile-row::before \{[^}]*left: 58px;/s', $css);
        // the unread dot moved with the bell: it sits inside the tile's top-right corner and stays orange
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon--unread::after \{[^}]*top: 6px;[^}]*right: 6px;[^}]*background: var\(--qm-new\);/s', $css);
        // read is muted, unread is orange, both still only colours (light mode changes the tokens, not these rules)
        $this->assertMatchesRegularExpression('/\.lan-mobile-row-icon \{[^}]*color: var\(--qm-muted\);/s', $css);
        $this->assertStringContainsString('.lan-mobile-row-icon--unread { color: var(--qm-new); }', $css);
        // the markup still puts the bell in that tile and the read/unread switch still toggles the same class
        $js = $this->js();
        $this->assertStringContainsString('<div class="lan-mobile-row-icon${unread ? \' lan-mobile-row-icon--unread\' : \'\'}">${lanMobileBell()}</div>', $js);
        $this->assertStringContainsString("icon.classList.toggle('lan-mobile-row-icon--unread', unread)", $js);
        // the tile only exists on the phone list: the desktop pane does not use these classes
        $this->assertStringNotContainsString('lan-mobile-row-icon', $this->between($js, 'window.lanRenderDesktopList = function', "\n};\n"));
    }

    public function test_unread_comes_from_the_same_read_list_the_desktop_pane_keeps(): void
    {
        $js = $this->js();
        // loaded before the phone rows are drawn so the dots are right on the first paint
        $render = $this->between($js, '// ── Phone: title and counts, search, filter chips', 'html += `</div>`; // close .lan-mobile-list');
        $this->assertStringContainsString('lanLoadRead();', $render);
        $this->assertStringContainsString('!lanReadSet.has(lanKey(', $render);
        // an unread group starts open; with nothing unread the first group opens instead of a column of folded labels
        $this->assertStringContainsString('const open = anyOpen ? groupHasUnread(g) : gi === 0;', $render);
        // and the read list itself is still the desktop's (same storage key, same keys)
        $this->assertStringContainsString("'lan.read.' + (window.learnerQueueUser || '')", $js);
    }

    public function test_search_and_filter_never_change_how_the_groups_are_folded(): void
    {
        $js = $this->js();
        $apply = $this->between($js, 'function lanMobileApply()', 'window.lanMobileSetFilter');
        $this->assertStringContainsString("list.classList.toggle('is-filtering', filtering);", $apply);
        // the list shows every match open through CSS, so no folded state is rewritten (or saved) by searching
        $this->assertStringNotContainsString("classList.remove('collapsed')", $apply);
        $this->assertStringContainsString('.lan-mobile-list.is-filtering .lan-mobile-folder-body.collapsed { display: block; }', $this->css());
        $toggle = $this->between($js, 'window.toggleLanMobileFolder', 'window._lanMobFilter');
        $this->assertStringContainsString("classList.contains('is-filtering')", $toggle);
    }

    public function test_search_looks_at_the_title_the_message_and_the_sender(): void
    {
        $apply = $this->between($this->js(), 'function lanMobileApply()', 'window.lanMobileSetFilter');
        $this->assertStringContainsString('`${ann.title || \'\'} ${ann.message || \'\'}`.toLowerCase()', $apply);
        $this->assertStringContainsString("header?.dataset.search", $apply);
    }

    public function test_the_filter_is_saved_and_restored_with_the_rest_of_the_page_state(): void
    {
        $js = $this->js();
        $this->assertStringContainsString("mobileFilter: window._lanMobFilter || 'all',", $js);
        $this->assertStringContainsString('window.lanMobileSetFilter(state.mobileFilter)', $js);
        $this->assertStringContainsString('lanMobileSetFolder(header, body, state.openFolders.includes(body.id))', $js);
        // the group ids did not change, so a fold saved by an older version still finds its group
        $this->assertStringContainsString("gid: 'lan-mg-school'", $js);
        $this->assertStringContainsString('gid: `lan-mg-teacher-${i}`', $js);
    }

    public function test_restoring_the_page_state_on_a_phone_does_not_open_an_announcement_behind_the_learners_back(): void
    {
        // the desktop pane marks what it shows as read after a moment, so it is only driven from 900px up
        $this->assertStringContainsString('window.innerWidth >= 900 && selectedIdx !== null', $this->js());
    }

    // ── reading ──────────────────────────────────────────────────────────────────────────────────

    public function test_opening_an_announcement_on_a_phone_reads_it_and_the_button_puts_it_back(): void
    {
        $js = $this->js();
        $open = $this->between($js, 'window.openMobileLearnerAnnouncement = function', 'window.openMobileLearnerAnnouncementById');
        $this->assertStringContainsString('window._lanRead.add(lanKey(ann));', $open);
        $this->assertStringContainsString('lanSaveRead();', $open);
        $this->assertStringContainsString('onclick="lanMobileToggleRead(${flatIdx})">Mark as unread</button>', $open);
        $toggle = $this->between($js, 'window.lanMobileToggleRead', '// ─────');
        $this->assertStringContainsString("'Mark as unread' : 'Mark as read'", $toggle);
        // "Mark all read" is on the list and only shows while something is unread
        $this->assertStringContainsString('onclick="lanMobileMarkAllRead()"${showMarkAll ? \'\' : \' hidden\'}>Mark all read</button>', $js);
        $this->assertStringContainsString('if (btn) btn.hidden = unreadTotal === 0;', $js);
    }

    public function test_the_detail_shows_who_it_is_from_and_who_it_is_for_and_keeps_the_trusted_edited_body(): void
    {
        $js = $this->js();
        $open = $this->between($js, 'window.openMobileLearnerAnnouncement = function', 'window.openMobileLearnerAnnouncementById');
        $this->assertStringContainsString("\${isSchool ? 'School-wide' : 'Announcement'}", $open);
        $this->assertStringContainsString('From</div>', $open);
        $this->assertStringContainsString('Sent to</div>', $open);
        $this->assertStringContainsString("isSchool ? 'Whole school' : 'Your class'", $open);
        $this->assertStringContainsString('Message</div>', $open);
        $this->assertStringContainsString('lan-mobile-detail-status--edited">Edited</span>', $open);
        // the server's already-escaped edited HTML is not escaped a second time
        $this->assertStringContainsString('${renderLearnerAnnouncementBody(ann)}', $open);
        // every other piece of text from the API goes through the escaper
        foreach (['escapeLearnerAnnouncementHtml(ann.title', 'escapeLearnerAnnouncementHtml(sender)', 'escapeLearnerAnnouncementHtml(roleLabel)', 'escapeLearnerAnnouncementHtml(ann.display_date)', 'escapeLearnerAnnouncementHtml(ann.edited_date'] as $escaped) {
            $this->assertStringContainsString($escaped, $open);
        }
    }

    // ── desktop and light mode ───────────────────────────────────────────────────────────────────

    public function test_from_900px_up_the_new_phone_pieces_are_hidden(): void
    {
        $desktop = $this->between($this->css(), '@media (min-width: 900px) {', '@media (max-width: 899px)');
        foreach (['.lan-mobile-list', '.lan-mobile-search-wrap', '.lan-mobile-head', '.lan-mobile-chips'] as $sel) {
            $this->assertStringContainsString($sel . ' ', $desktop);
        }
        $this->assertStringContainsString('display: none !important', $desktop);
        $this->assertStringContainsString("@media (min-width: 900px) {\n    .lan-mobile-detail { display: none; }\n}", $this->css());
    }

    public function test_light_mode_is_the_light_set_of_tokens_on_phones_and_in_the_769_to_899_range(): void
    {
        $css = $this->css();
        foreach (['html[data-learner-theme="light"]', 'html[data-learner-mobile-theme="light"]'] as $attr) {
            foreach (['.lan-mobile-head', '.lan-mobile-search-wrap', '.lan-mobile-chips', '.lan-mobile-list', '.lan-mobile-detail'] as $sel) {
                $this->assertSame(1, preg_match('/^' . preg_quote($attr . ' ' . $sel, '/') . '[,\s{]/m', $css), 'announcements.css misses ' . $attr . ' ' . $sel);
            }
        }
        // the same light values as the Assignments and Quiz pages, plus the two accents this page uses
        $this->assertSame(2, substr_count($css, '--qm-title: #282924;'));
        $this->assertSame(2, substr_count($css, '--qm-chipon: #252624;'));
        $this->assertSame(2, substr_count($css, '--qm-new: #b85f12;'));
        $this->assertSame(2, substr_count($css, '--qm-edit: #b8553a;'));
    }

    public function test_the_phone_light_block_is_still_only_light_rules(): void
    {
        $css = $this->css();
        $block = substr($css, strrpos($css, '@media (max-width: 768px) {'));
        preg_match_all('/^(html\S*)/m', $block, $m);
        $this->assertSame(['html[data-learner-mobile-theme="light"]'], array_values(array_unique($m[1])));
    }

    public function test_the_changed_files_have_new_cache_versions(): void
    {
        // the service worker caches /assets/ by full URL: a changed file under an unchanged ?v= is never fetched again
        $php = $this->source('learner_dashboard.php');
        foreach (['learner/announcements.css?v=4.5', 'learner/announcements.js?v=9.8'] as $pinned) {
            $this->assertStringContainsString($pinned, $php, "$pinned is not what the page links");
        }
    }
}
