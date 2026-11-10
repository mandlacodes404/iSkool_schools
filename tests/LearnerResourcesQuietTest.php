<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the "quiet list" on the learner phone Resources page: a title with a counts line, a search box, type chips
 * (All, Docs, Videos, Images), then a plain label for each teacher with one row per file (a soft tile showing the file
 * type, or a play mark for a video, the title, and size and date). Tapping a row opens the file on its own screen in the
 * same look as the assignment detail (what it is, a 26px title, when it was uploaded, for a video the player, who it is
 * from and how big it is, Open and Download, and more from the same teacher). It replaces the old folder boxes, the
 * folder icon and the video cards that played inside the list. Everything uses the weights the phone pages already had
 * (400 for text, 600 for titles and names), so nothing in this look is 700 or heavier, and there is no purple.
 * Desktop (900px and up) keeps its own split layout untouched.
 * How it looks was checked by eye in a phone-sized browser with the real script and stylesheet (dark and light, narrow and
 * wide phones, long titles, a title written as HTML, every chip, search, folding, a file and a video screen and coming
 * back, and the empty states); these read the sources so the things a later edit could quietly undo stay put.
 */
final class LearnerResourcesQuietTest extends TestCase
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
        return $this->source('assets/js/learner/resources.js');
    }

    private function css(): string
    {
        return $this->source('assets/css/learner/resources.css');
    }

    /** The phone stylesheet: the list, the empty states and the file screen */
    private function phoneCss(): string
    {
        return $this->between($this->css(), '/* ── MOBILE LIST: the quiet list', '/* ── SHARED UTILITIES ── */');
    }

    /** The phone script: the rows, the search, the chips, the groups and the open file */
    private function phoneScript(): string
    {
        return $this->between($this->js(), "window._lrsMobFilter = 'all';", 'function escapeResourceHtml(value) {');
    }

    private function renderer(): string
    {
        return $this->between($this->js(), 'function renderResourceCards(data) {', "\n}\n");
    }

    // ── weights and colours ──────────────────────────────────────────────────────────────────────

    public function test_nothing_in_the_phone_list_or_file_screen_is_heavier_than_600(): void
    {
        $css = $this->phoneCss();
        preg_match_all('/font-weight:\s*(\d+)/', $css, $m);
        $this->assertNotEmpty($m[1]);
        foreach ($m[1] as $weight) {
            $this->assertLessThanOrEqual(600, (int) $weight, 'font-weight ' . $weight . ' is heavier than the phone pages use');
        }
        foreach (['#a78bfa', '#7c3aed', '#8b5cf6', '#f28c38'] as $colour) {
            $this->assertStringNotContainsString($colour, $css, "$colour has no place in the quiet phone look");
        }
    }

    public function test_the_old_folder_box_folder_icon_and_inline_video_card_are_gone(): void
    {
        $js = $this->js();
        $css = $this->css();
        foreach (['lrs-mobile-video-card', 'lrs-mobile-video-wrap', 'lrs-mobile-video-title', 'lrs-mobile-folder-icon', 'getFileIconThin', 'lrs-bullet-muted'] as $old) {
            $this->assertStringNotContainsString($old, $js, "$old is still in resources.js");
            $this->assertStringNotContainsString($old, $css, "$old is still in resources.css");
        }
        // a video no longer plays inside the list: the only iframes the phone script draws are on a file's own screen
        $this->assertStringNotContainsString('<iframe', $this->between($this->phoneScript(), 'function lrsMobileRowHtml(', "\n}\n"));
    }

    // ── the list: title, counts, search, chips, groups, rows ────────────────────────────────────

    public function test_the_list_has_a_title_a_counts_line_a_search_box_and_four_type_chips(): void
    {
        $script = $this->phoneScript();
        $this->assertStringContainsString('<h1 class="lrs-mobile-title">Resources</h1>', $script);
        $this->assertStringContainsString('id="lrsMobileSub"', $script);
        $this->assertStringContainsString('id="lrsMobileSearch"', $script);
        $this->assertStringContainsString('oninput="lrsMobileSearch(this.value)"', $script);
        $renderer = $this->renderer();
        $this->assertStringContainsString("[['all', 'All'], ['doc', 'Docs'], ['vid', 'Videos'], ['img', 'Images']]", $renderer);
        $this->assertStringContainsString('role="group" aria-label="Filter resources by type"', $renderer);
        $this->assertStringContainsString("onclick=\"lrsMobileSetFilter('\${k}')\"", $renderer);
        $this->assertStringContainsString('${label} ${catCounts[k]}', $renderer, 'each chip shows how many files it holds');
        // Docs is everything that is neither a video nor a picture
        $this->assertStringContainsString("function lrsCat(kind) { return kind === 'vid' ? 'vid' : kind === 'img' ? 'img' : 'doc'; }", $this->js());
        // the search box is 16px so iOS does not zoom the page when it is focused
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.lrs-mobile-search \{[^}]*font-size: 16px;/s', $css);
        // chips are 32px high with 13px text and a 6px gap, the same as the other quiet lists
        $this->assertMatchesRegularExpression('/\.lrs-mobile-chips \{[^}]*gap: 6px;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-chip \{[^}]*height: 32px;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-chip \{[^}]*font-size: 13px;/s', $css);
    }

    public function test_the_counts_line_counts_files_and_teachers_and_says_x_of_n_while_filtering(): void
    {
        $summary = $this->between($this->phoneScript(), 'function lrsMobileSummary(', "\n}\n");
        $this->assertStringContainsString('${shown} of ${plural(total, \'file\')}', $summary);
        $this->assertStringContainsString("plural(teachers, 'teacher')", $summary);
        $this->assertStringContainsString('teachers > 0', $summary, 'no "0 teachers" when nothing matches');
    }

    public function test_every_row_carries_its_index_and_id_and_opens_the_file(): void
    {
        $row = $this->between($this->phoneScript(), 'function lrsMobileRowHtml(', "\n}\n");
        $this->assertStringContainsString('data-idx="${idx}"', $row);
        // manual.js finds a file from the Home screen by this attribute
        $this->assertStringContainsString('data-resource-id="${escapeResourceHtml(file.id)}"', $row);
        $this->assertStringContainsString('data-cat="${lrsCat(kind)}"', $row);
        $this->assertStringContainsString('onclick="openMobileLearnerResource(${idx})"', $row);
        $this->assertStringContainsString('role="button" tabindex="0"', $row, 'a row can be reached and opened from the keyboard');
        $this->assertStringContainsString("event.key === 'Enter'", $row);
        // the tile shows the file type, or a play mark for a video
        $this->assertStringContainsString('${isVid ? LRS_PLAY_ICON : escapeResourceHtml(lrsTag(file, kind))}', $row);
        // a video says where it is from instead of a size
        $this->assertStringContainsString("isVid ? 'YouTube' : lrsMobileSize(file.size)", $row);
    }

    public function test_sizes_are_tidied_from_two_decimals(): void
    {
        $size = $this->between($this->phoneScript(), 'function lrsMobileSize(size) {', "\n}\n");
        $this->assertStringContainsString("replace(/\\.00 /, ' ')", $size, '"2.00 MB" reads "2 MB"');
        $this->assertStringContainsString("replace(/(\\.\\d)0 /, '\$1 ')", $size, '"2.10 MB" reads "2.1 MB"');
    }

    public function test_rows_use_the_same_inset_as_the_other_quiet_lists_and_the_hairline_starts_after_the_tile(): void
    {
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.lrs-mobile-row \{[^}]*padding: 11px 20px;/s', $css);
        // 20px inset + 40px tile + 14px gap = 74px, so the line starts under the title, not under the tile
        $this->assertMatchesRegularExpression('/\.lrs-mobile-row::before \{[^}]*left: 74px;/s', $css);
        $this->assertStringContainsString('.lrs-mobile-row--first::before', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-row:active \{[^}]*var\(--qm-press\)/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-row-icon \{[^}]*width: 40px;[^}]*height: 40px;[^}]*border-radius: 12px;[^}]*background: var\(--qm-surf\);/s', $css);
    }

    public function test_the_teachers_are_plain_labels_that_fold_and_only_the_first_starts_open(): void
    {
        $renderer = $this->renderer();
        $this->assertStringContainsString('const open = gi === 0;', $renderer);
        $this->assertStringContainsString('role="button" tabindex="0"', $renderer);
        $this->assertStringContainsString('aria-expanded="${open}"', $renderer);
        $this->assertStringContainsString("onclick=\"toggleLrsMobileFolder('\${gid}', this)\"", $renderer);
        // a group's rows are consecutive entries of the flat list, which is what data-idx points at
        $this->assertStringContainsString('lrsMobileRowHtml(flatAll[flatCursor], flatCursor, rowIdx === 0)', $renderer);
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.lrs-mobile-folder-name \{[^}]*font-size: 14px;[^}]*font-weight: 600;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-folder-header--collapsed \.lrs-mobile-folder-chevron \{ transform: rotate\(-90deg\); \}/', $css);
    }

    public function test_folding_keeps_the_name_and_signature_the_home_screen_calls(): void
    {
        // manual.js opens the group that holds a file by calling toggleLrsMobileFolder(folder.id, header)
        $manual = $this->source('assets/js/learner/manual.js');
        $this->assertStringContainsString("rowSelector: '.lrs-mobile-row, .lrs-mobile-video-card'", $manual);
        $this->assertStringContainsString("rowIdKey: 'resourceId'", $manual);
        $this->assertStringContainsString('toggle: window.toggleLrsMobileFolder', $manual);
        $toggle = $this->between($this->phoneScript(), 'window.toggleLrsMobileFolder = function(id, headerEl) {', "\n};\n");
        $this->assertStringContainsString("classList.contains('is-filtering')", $toggle, 'while filtering every matching group shows open, so there is nothing to fold');
        $this->assertStringContainsString('lrsMobileSetFolder(headerEl, body, body.classList.contains(\'collapsed\'))', $toggle);
        $this->assertStringContainsString('saveResourcePageState();', $toggle);
        $this->assertStringContainsString('recheckMobileNavAfterToggle();', $toggle);
        $set = $this->between($this->phoneScript(), 'function lrsMobileSetFolder(', "\n}\n");
        $this->assertStringContainsString("header.setAttribute('aria-expanded'", $set);
    }

    // ── search and chips ─────────────────────────────────────────────────────────────────────────

    public function test_search_and_chips_filter_together_and_look_at_title_teacher_type_and_extension(): void
    {
        $apply = $this->between($this->phoneScript(), 'function lrsMobileApply() {', "\n}\n");
        $this->assertStringContainsString("file.title || ''", $apply);
        $this->assertStringContainsString("file.teacher || ''", $apply);
        $this->assertStringContainsString("file.ext || ''", $apply);
        $this->assertStringContainsString('lrsTypeLabel(kind)', $apply);
        $this->assertStringContainsString("(filter === 'all' || lrsCat(kind) === filter) && (!term || hay.includes(term))", $apply);
        // the first visible row of every group loses its top hairline, recomputed after every filter
        $this->assertStringContainsString("row.classList.toggle('lrs-mobile-row--first', show && here === 0)", $apply);
        // groups with nothing in them hide, and the others show how many match
        $this->assertStringContainsString("header.style.display = any ? '' : 'none'", $apply);
        $this->assertStringContainsString("count.textContent = String(here)", $apply);
        $this->assertStringContainsString("getElementById('lrsMobileSub')", $apply);
        $this->assertStringContainsString('No matches for "', $apply);
        $this->assertStringContainsString("doc: 'documents', vid: 'videos', img: 'images'", $apply, 'a chip with nothing in it says which type');
        // the page height changes without a scroll event, so the header and bottom nav are re-checked
        $this->assertStringContainsString('recheckMobileNavAfterToggle();', $apply);
    }

    public function test_the_search_text_and_the_chip_are_remembered_with_the_rest_of_the_page_state(): void
    {
        $script = $this->phoneScript();
        $search = $this->between($script, 'window.lrsMobileSearch = function(val) {', "\n};\n");
        $this->assertStringContainsString("learnerPageState.update('resources', { mobileSearch: val })", $search);
        $this->assertStringContainsString('lrsMobileApply();', $search);
        $chip = $this->between($script, 'window.lrsMobileSetFilter = function(kind) {', "\n};\n");
        $this->assertStringContainsString("learnerPageState.update('resources', { mobileFilter: window._lrsMobFilter })", $chip);
        $this->assertStringContainsString("chip.setAttribute('aria-pressed'", $chip);
        $this->assertStringContainsString('lrsMobileApply();', $chip);
        $save = $this->between($this->js(), 'function saveResourcePageState() {', "\n}\n");
        $this->assertStringContainsString("mobileFilter: window._lrsMobFilter || 'all'", $save);
        $restore = $this->between($this->js(), 'function restoreResourcePageState() {', "\n}\n");
        $this->assertStringContainsString('window.lrsMobileSetFilter(state.mobileFilter)', $restore);
        $this->assertStringContainsString('lrsMobileSetFolder(header, body, state.openFolders.includes(body.id))', $restore);
    }

    // ── the open file ────────────────────────────────────────────────────────────────────────────

    public function test_an_open_file_shows_its_type_title_date_sender_size_and_more_from_the_same_teacher(): void
    {
        $detail = $this->between($this->phoneScript(), 'function lrsMobileDetailHtml(file, idx) {', "\n}\n");
        $this->assertStringContainsString('lrs-mobile-detail-eyebrow">${escapeResourceHtml(lrsTypeLabel(kind))}', $detail);
        $this->assertStringContainsString('<h1 class="lrs-mobile-detail-title">${title}</h1>', $detail);
        $this->assertStringContainsString('Uploaded ${escapeResourceHtml(uploaded)}', $detail);
        $this->assertStringContainsString('fact-label">From<', $detail);
        $this->assertStringContainsString("isVid ? 'Source' : 'Size'", $detail);
        $this->assertStringContainsString("isVid ? 'YouTube' : (escapeResourceHtml(lrsMobileSize(file.size)) || 'N/A')", $detail);
        $this->assertStringContainsString('More from ${escapeResourceHtml(file.teacher || \'\')}', $detail);
        $this->assertStringContainsString('.slice(0, 3)', $detail);
        $this->assertStringContainsString('f.teacher === file.teacher', $detail);
    }

    public function test_a_file_has_open_and_download_and_a_video_has_a_player_and_open_in_youtube(): void
    {
        $detail = $this->between($this->phoneScript(), 'function lrsMobileDetailHtml(file, idx) {', "\n}\n");
        $this->assertStringContainsString('onclick="lrsMobileOpenFile(${idx})">Open</button>', $detail);
        $this->assertStringContainsString('href="${escapeResourceHtml(file.path)}" download>Download</a>', $detail);
        $this->assertStringContainsString('Open in YouTube', $detail);
        $this->assertStringContainsString('<div class="lrs-mobile-player"><iframe', $detail);
        // the same global viewer the rest of the app uses
        $open = $this->between($this->phoneScript(), 'window.lrsMobileOpenFile = function(idx) {', "\n};\n");
        $this->assertStringContainsString('window.viewDocument(file.path, file.title || \'\')', $open);
        // the file is found by index, so no title or path is ever put inside a JavaScript string in the markup
        $this->assertStringNotContainsString("viewDocument('", $detail);
    }

    public function test_the_player_and_the_youtube_link_are_built_only_from_the_eleven_character_video_id(): void
    {
        $script = $this->phoneScript();
        $id = $this->between($script, 'function lrsYoutubeId(file) {', "\n}\n");
        $this->assertStringContainsString('embed\/([A-Za-z0-9_-]{11})', $id);
        $detail = $this->between($script, 'function lrsMobileDetailHtml(file, idx) {', "\n}\n");
        $this->assertStringContainsString('https://www.youtube.com/embed/${ytId}?rel=0&amp;modestbranding=1', $detail);
        $this->assertStringContainsString('https://www.youtube.com/watch?v=${ytId}', $detail);
        $this->assertStringContainsString('rel="noopener"', $detail);
        $this->assertStringContainsString('referrerpolicy="strict-origin-when-cross-origin"', $detail);
        // the stored address itself never reaches an src or an href on the phone
        $this->assertStringNotContainsString('file.video_url', $detail);
        $this->assertStringNotContainsString('video_url', $this->between($script, 'function lrsMobileRowHtml(', "\n}\n"));
    }

    public function test_text_from_the_api_is_escaped_in_the_rows_and_the_open_file(): void
    {
        $script = $this->phoneScript();
        $row = $this->between($script, 'function lrsMobileRowHtml(', "\n}\n");
        $detail = $this->between($script, 'function lrsMobileDetailHtml(file, idx) {', "\n}\n");
        foreach (['file.title', 'file.id'] as $field) {
            $this->assertStringContainsString("escapeResourceHtml($field", $row);
        }
        $this->assertStringContainsString('.map(escapeResourceHtml)', $row, 'size and date');
        foreach (['lrsTypeLabel(kind)', 'file.teacher', 'file.path', 'uploaded'] as $field) {
            $this->assertStringContainsString("escapeResourceHtml($field", $detail);
        }
        $this->assertStringContainsString("const title = escapeResourceHtml(file.title || 'Untitled');", $detail);
        // nothing from the API is dropped into the markup raw
        $this->assertDoesNotMatchRegularExpression('/\$\{(?:file|f)\.(?:title|teacher|path|size|id|uploaded_at)\}/', $row . $detail);
        // the group names and the group label are escaped in the list too
        $this->assertStringContainsString('${escapeResourceHtml(teacher)}', $this->renderer());
    }

    public function test_opening_a_file_keeps_the_bottom_nav_and_goes_back_to_the_list(): void
    {
        $open = $this->between($this->phoneScript(), 'window.openMobileLearnerResource = function(idx) {', "\n};\n");
        $this->assertStringContainsString('if (window.innerWidth > 899) return;', $open, 'desktop never opens the phone file screen');
        $this->assertStringContainsString("mode: 'detail'", $open);
        $this->assertStringContainsString("detailType: 'Resource'", $open);
        $this->assertStringContainsString("backLabel: 'Resources'", $open);
        $this->assertStringContainsString('backAction: () => window.fetchResources()', $open);
        // detail mode hides the bottom nav; the phone detail screens put it back
        $this->assertStringContainsString("getElementById('mobileBottomNav')", $open);
        $this->assertStringContainsString("nav.style.setProperty('display', 'flex', 'important')", $open);
        $this->assertStringContainsString('lrsMobileDetailHtml(file, idx)', $open);
    }

    public function test_the_list_scroll_is_saved_before_the_file_opens_and_not_overwritten_by_it(): void
    {
        $js = $this->js();
        $open = $this->between($this->phoneScript(), 'window.openMobileLearnerResource = function(idx) {', "\n};\n");
        $this->assertLessThan(strpos($open, 'window._lrsMobDetail = true;'), strpos($open, 'saveResourcePageState();'), 'the list state is saved first');
        $save = $this->between($js, 'function saveResourcePageState() {', "\n}\n");
        $this->assertStringContainsString('if (window._lrsMobDetail) return;', $save);
        // drawing the list again clears the flag, the chip and the search
        $renderer = $this->renderer();
        foreach (['window._lrsMobDetail = false;', "window._lrsMobFilter = 'all';", "window._lrsMobTerm = '';"] as $reset) {
            $this->assertStringContainsString($reset, $renderer);
        }
    }

    public function test_the_file_screen_uses_the_same_look_as_the_assignment_detail(): void
    {
        $css = $this->phoneCss();
        $this->assertMatchesRegularExpression('/\.lrs-mobile-detail-title \{[^}]*font-size: 26px;[^}]*font-weight: 600;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-detail-facts \{[^}]*background: var\(--qm-surf\);[^}]*border-radius: 18px;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-player \{[^}]*aspect-ratio: 16 \/ 9;/s', $css);
        $this->assertMatchesRegularExpression('/\.lrs-mobile-btn \{[^}]*min-height: 48px;/s', $css);
        $this->assertStringContainsString('.lrs-mobile-btn--pri { background: var(--qm-chipon); color: var(--qm-chipon-text); }', $css);
    }

    public function test_the_empty_states_say_what_is_going_on(): void
    {
        $renderer = $this->renderer();
        $this->assertStringContainsString('No resources yet', $renderer);
        $this->assertStringContainsString("Your teachers haven't posted any resources. Check back soon.", $renderer);
        $this->assertStringContainsString('id="lrsMobileSearchEmpty"', $renderer, 'the "No matches" state is drawn hidden and shown by the filter');
    }

    // ── desktop and light mode ───────────────────────────────────────────────────────────────────

    public function test_the_phone_parts_are_hidden_from_900px_up_and_the_desktop_split_layout_is_kept(): void
    {
        $css = $this->css();
        $this->assertMatchesRegularExpression('/@media \(min-width: 900px\) \{\s*\.lrs-desktop-layout \{ display: flex !important; \}\s*\.lrs-mobile-head, \.lrs-mobile-search-wrap, \.lrs-mobile-chips, \.lrs-mobile-list, \.lrs-mobile-detail \{ display: none !important; \}/', $css);
        $this->assertMatchesRegularExpression('/@media \(max-width: 899px\) \{\s*\.lrs-desktop-layout \{ display: none !important; \}/', $css);
        $js = $this->js();
        foreach (['lrsInitDesktop', 'lrsRenderDesktopList', 'selectDesktopLearnerResource', 'lrsMobileSearch', 'lrsEnsureSelection'] as $name) {
            $this->assertStringContainsString($name, $js, "$name was lost");
        }
        // the desktop panel still builds its own player from the stored address; only the phone is built from the id
        $this->assertStringContainsString('lrsYoutubeWatchUrl(file)', $this->between($js, 'window.selectDesktopLearnerResource = function', "\n};\n"));
    }

    public function test_light_mode_only_changes_the_colour_tokens_in_both_phone_light_blocks(): void
    {
        $css = $this->css();
        $widerLight = $this->between($css, '/* ── 769px to 899px: the split layout starts at 900px', 'html[data-learner-theme="light"] .lrs-error-state');
        $phoneLight = substr($css, strpos($css, '/* ── Phones (768px and narrower): light mode'));
        $this->assertStringContainsString('html[data-learner-theme="light"] .lrs-mobile-detail', $widerLight);
        $this->assertStringContainsString('@media (max-width: 768px)', $phoneLight);
        $this->assertStringContainsString('html[data-learner-mobile-theme="light"] .lrs-mobile-detail', $phoneLight);
        foreach ([$widerLight, $phoneLight] as $block) {
            foreach (['--qm-title: #282924;', '--qm-body: #4a4b44;', '--qm-muted: #73746d;', '--qm-surf: #f1efe8;', '--qm-chipon: #252624;', '--qm-chipon-text: #faf9f5;'] as $token) {
                $this->assertStringContainsString($token, $block);
            }
        }
        // the phone block sets nothing but the tokens and the error colour
        preg_match_all('/^\s+([a-z-]+)\s*:/m', substr($phoneLight, strpos($phoneLight, '{', strpos($phoneLight, 'html[') + 1)), $props);
        foreach ($props[1] as $prop) {
            $this->assertStringStartsWith('--qm-', $prop, "light mode sets $prop, not just a colour token");
        }
    }

    public function test_the_dark_tokens_match_the_other_quiet_lists(): void
    {
        $css = $this->phoneCss();
        foreach ([
            '--qm-title: #ecece9;', '--qm-body: #c2c3b7;', '--qm-muted: #8b8b87;', '--qm-faint: #5f605a;',
            '--qm-surf: #272726;', '--qm-ring: #73746d;', '--qm-chipon: #ecece9;', '--qm-chipon-text: #20201f;',
        ] as $token) {
            $this->assertStringContainsString($token, $css);
        }
    }

    public function test_the_light_gate_knows_the_file_screen(): void
    {
        // the open file replaces the list, so it needs its own marker in the gate or the page would stay dark in light mode
        $gate = $this->source('assets/css/learner/mobile_light.css');
        $this->assertStringContainsString('.lrs-mobile-list, .lrs-mobile-detail, .lrs-error-state', $gate);
        $this->assertStringContainsString('.lrs-mobile-list, .lrs-mobile-detail, .lrs-error-state', $this->source('assets/js/learner/mobile_theme.js'));
        $this->assertStringContainsString('<article class="lrs-mobile-detail">', $this->js());
    }

    // ── versions ─────────────────────────────────────────────────────────────────────────────────

    public function test_the_dashboard_loads_the_changed_files_with_fresh_version_numbers(): void
    {
        $php = $this->source('learner_dashboard.php');
        $this->assertStringContainsString('resources.css?v=3.4', $php);
        $this->assertStringContainsString('resources.js?v=9.0', $php);
        $this->assertStringNotContainsString('resources.css?v=3.3', $php);
        $this->assertStringNotContainsString('resources.js?v=8.9', $php);
        // The light-mode gate (mobile_light.css) and its marker list (mobile_theme.js) were changed to know the open file. A phone
        // that kept the old copies of those two draws the file screen's light colours on a page that stays dark, so the title and
        // the rows vanish. Both need a new number whenever a marker is added.
        $this->assertStringContainsString('learner/mobile_light.css?v=2.2', $php);
        $this->assertStringNotContainsString('learner/mobile_light.css?v=2.1', $php);
        $this->assertStringContainsString('learner/mobile_theme.js?v=1.9', $php);
        $this->assertStringNotContainsString('learner/mobile_theme.js?v=1.8', $php);
    }
}
