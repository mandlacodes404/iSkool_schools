<?php
use PHPUnit\Framework\TestCase;

/**
 * Guards for the side padding of the learner's phone detail screens (an open assignment, announcement and evaluation,
 * the syllabus page and an open resource). On a phone #api-content-area pads 18px (quiz.css). The lists cancel that with -18px side
 * margins and inset their rows by 18px, so the detail screens must do the same, or their text sits closer to the screen
 * edge than the list it came from (16px) or much further in (34px and 32px). These checks read the sources for the
 * things a later edit could quietly undo. How the screens look was checked in a phone-sized browser with the real
 * stylesheets, not here.
 */
final class LearnerDetailPagesPaddingTest extends TestCase
{
    private function source(string $path): string
    {
        return file_get_contents(__DIR__ . '/../' . $path);
    }

    /** CSS file => the class of the detail root in it */
    private const DETAIL_ROOTS = [
        'assets/css/learner/assignments.css'    => '.las-mobile-detail',
        'assets/css/learner/announcements.css'  => '.lan-mobile-detail',
        'assets/css/learner/evaluations.css'    => '.lev-mobile-detail',
    ];

    /** The side padding each detail root uses, which is the inset of the rows in its own list. The quiet Assignments,
     *  Announcements and Evaluations lists (and so their detail screens) all inset by 20px. The top and bottom padding are
     *  not part of this check. */
    private const DETAIL_PADDING = [
        'assets/css/learner/assignments.css'    => '\d+px 20px 96px',
        'assets/css/learner/announcements.css'  => '\d+px 20px 96px',
        'assets/css/learner/evaluations.css'    => '\d+px 20px 96px',
    ];

    public function test_each_detail_root_pads_like_the_list_rows_at_the_sides(): void
    {
        foreach (self::DETAIL_ROOTS as $file => $selector) {
            $css = $this->source($file);
            $this->assertSame(
                1,
                preg_match('/^\s*' . preg_quote($selector, '/') . ' \{[^}]*padding:\s*' . self::DETAIL_PADDING[$file] . ';/m', $css),
                $file . ': ' . $selector . ' must pad at the sides by the same as its list rows'
            );
            $this->assertSame(0, preg_match('/' . preg_quote($selector, '/') . ' \{[^}]*padding:\s*18px 16px/', $css), $file . ' still pads 16px');
        }
    }

    public function test_each_detail_root_cancels_the_18px_of_the_content_area_like_the_lists(): void
    {
        foreach (self::DETAIL_ROOTS as $file => $selector) {
            $css = $this->source($file);
            $this->assertSame(
                1,
                preg_match('/' . preg_quote($selector, '/') . ' \{[^}]*margin-left:\s*-18px;\s*margin-right:\s*-18px;/', $css),
                $file . ': ' . $selector . ' must cancel the 18px of #api-content-area with -18px side margins'
            );
        }
    }

    public function test_the_content_area_still_pads_18px_on_a_phone(): void
    {
        // The two numbers above only line up while this is 18px
        $css = $this->source('assets/css/learner/quiz.css');
        $this->assertSame(1, preg_match('/@media \(max-width: 767px\) \{[^@]*#api-content-area:not\(\.disc-thread-active\) \{[^}]*padding:\s*18px !important;/s', $css));
    }

    public function test_the_evaluation_form_fits_inside_the_padded_detail(): void
    {
        $css = $this->source('assets/css/learner/evaluations.css');
        // the button runs the width of the padded content with no side margins of its own
        $this->assertSame(1, preg_match('/\.lev-mobile-detail-action \{[^}]*width:\s*100%;[^}]*box-sizing:\s*border-box;/s', $css), 'the submit button runs the full width of the content');
        // width:100% plus padding is wider than the box unless it is border-box, and the page has no global reset
        $this->assertSame(1, preg_match('/\.lev-mobile-comments textarea \{[^}]*box-sizing:\s*border-box;/s', $css), 'the comments box would run past the screen edge');
    }

    public function test_the_syllabus_phone_list_and_detail_sit_at_the_same_side_inset_as_the_other_quiet_lists(): void
    {
        $js = $this->source('assets/js/learner/syllabus.js');
        // the old wrapper and its extra 14px each side (which pushed the cards in to 32px) are gone
        $this->assertStringNotContainsString('.syl-wrapper', $js);
        $this->assertSame(0, preg_match('/\.syl-wrapper \{ padding: 16px 14px; \}/', $js));
        // the list cancels the content area's 18px and insets its rows by 20px; the detail does the same
        $this->assertSame(1, preg_match('/\.syl-mobile-list \{ margin-left: -18px; margin-right: -18px; \}/', $js), 'the list cancels the 18px of #api-content-area');
        $this->assertSame(1, preg_match('/\.syl-mobile-detail \{ margin-left: -18px; margin-right: -18px; \}/', $js), 'the detail cancels the 18px of #api-content-area');
        $this->assertSame(1, preg_match('/\.syl-mobile-detail \{ padding: 8px 20px 96px; \}/', $js));
        $this->assertSame(1, preg_match('/\.syl-mobile-row \{[^}]*padding: 11px 20px;/s', $js));
    }

    public function test_the_resources_phone_list_and_file_screen_sit_at_the_same_side_inset_as_the_other_quiet_lists(): void
    {
        $css = $this->source('assets/css/learner/resources.css');
        // the list and the file screen cancel the content area's 18px (phones and the 769-899px range) and inset their text by 20px
        $this->assertSame(1, preg_match('/@media \(max-width: 899px\) \{\s*\.lrs-mobile-list \{\s*margin-left: -18px;\s*margin-right: -18px;/s', $css), 'the list cancels the 18px of #api-content-area');
        $this->assertSame(1, preg_match('/@media \(max-width: 899px\) \{\s*\.lrs-mobile-detail \{\s*margin-left: -18px;\s*margin-right: -18px;/s', $css), 'the file screen cancels the 18px of #api-content-area');
        $this->assertSame(1, preg_match('/\.lrs-mobile-detail \{\s*\/\*[^*]*\*\/\s*padding: 8px 20px 96px;/s', $css));
        $this->assertSame(1, preg_match('/\.lrs-mobile-row \{[^}]*padding: 11px 20px;/s', $css));
        $this->assertSame(1, preg_match('/\.lrs-mobile-folder-header \{[^}]*padding: 20px 20px 4px;/s', $css));
        // "more from this teacher" rows run edge to edge inside the padded file screen
        $this->assertSame(1, preg_match('/\.lrs-mobile-more \{ margin: 0 -20px; \}/', $css));
    }

    public function test_the_dashboard_loads_the_changed_files_with_a_fresh_version_number(): void
    {
        // The browser and the installed app keep files by full URL, so a changed file needs a new ?v= number
        $php = $this->source('learner_dashboard.php');
        foreach ([
            'assets/css/learner/announcements.css?v=4.5',
            'assets/css/learner/assignments.css?v=4.4',
            'assets/css/learner/evaluations.css?v=5.7',
               'assets/js/learner/syllabus.js?v=4.8',
            'assets/css/learner/resources.css?v=3.4',
            'assets/js/learner/resources.js?v=9.0',
        ] as $versioned) {
            $this->assertStringContainsString($versioned, $php);
        }
    }
}
