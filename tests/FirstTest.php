<?php
use PHPUnit\Framework\TestCase;

class FirstTest extends TestCase
{
    public function test_php_unit_is_working()
    {
        $this->assertTrue(true);
    }

    public function test_math_still_works()
    {
        $this->assertEquals(4, 2 + 2);
    }
}

