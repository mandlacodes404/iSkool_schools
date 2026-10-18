<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../auth/parent_invite_functions.php';

final class ParentInviteFunctionsTest extends TestCase
{
    public function test_generated_codes_are_32_hex_characters_and_different_each_time(): void
    {
        $a = parent_invite_generate_code();
        $b = parent_invite_generate_code();
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $a);
        $this->assertNotSame($a, $b);
    }

    public function test_code_format_check_accepts_generated_codes_only(): void
    {
        $this->assertTrue(parent_invite_is_valid_code_format(parent_invite_generate_code()));
        $this->assertFalse(parent_invite_is_valid_code_format(''));
        $this->assertFalse(parent_invite_is_valid_code_format(str_repeat('a', 31)));
        $this->assertFalse(parent_invite_is_valid_code_format(str_repeat('a', 33)));
        $this->assertFalse(parent_invite_is_valid_code_format(str_repeat('A', 32)));
        $this->assertFalse(parent_invite_is_valid_code_format(str_repeat('g', 32)));
        $this->assertFalse(parent_invite_is_valid_code_format(str_repeat('a', 32) . "\n"));
        $this->assertFalse(parent_invite_is_valid_code_format("' OR 1=1 --"));
        $this->assertFalse(parent_invite_is_valid_code_format(null));
        $this->assertFalse(parent_invite_is_valid_code_format(['a']));
    }

    public function test_hash_is_a_stable_64_character_digest_that_is_not_the_code(): void
    {
        $code = parent_invite_generate_code();
        $hash = parent_invite_hash($code);
        $this->assertSame($hash, parent_invite_hash($code));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hash);
        $this->assertNotSame($code, $hash);
        $this->assertNotSame($hash, parent_invite_hash(parent_invite_generate_code()));
    }

    public function test_expiry_is_48_hours_after_creation(): void
    {
        $now = 1_800_000_000;
        $this->assertSame(date('Y-m-d H:i:s', $now + 48 * 3600), parent_invite_expiry($now));
    }

    public function test_is_expired_is_false_before_and_true_at_or_after_the_expiry_time(): void
    {
        $now = 1_800_000_000;
        $expires = date('Y-m-d H:i:s', $now + 100);
        $this->assertFalse(parent_invite_is_expired($expires, $now));
        $this->assertTrue(parent_invite_is_expired($expires, $now + 100));
        $this->assertTrue(parent_invite_is_expired($expires, $now + 101));
    }

    public function test_unreadable_expiry_counts_as_expired(): void
    {
        $this->assertTrue(parent_invite_is_expired('not a date'));
    }

    public function test_display_name_joins_name_and_surname_and_ignores_empty_parts(): void
    {
        $this->assertSame('Thandi Mokoena', parent_invite_display_name('Thandi', 'Mokoena'));
        $this->assertSame('Thandi', parent_invite_display_name('Thandi', null));
        $this->assertSame('Mokoena', parent_invite_display_name('', ' Mokoena '));
        $this->assertSame('', parent_invite_display_name(null, null));
    }
}
