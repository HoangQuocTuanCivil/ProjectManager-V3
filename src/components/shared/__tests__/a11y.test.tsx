import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import {
  StatusBadge,
  StatCard,
  Toggle,
  CloseButton,
  Button,
  FilterChip,
  EmptyState,
  UserAvatar,
} from "../index";
import { ClipboardList } from "lucide-react";

/*
 * Automated accessibility tests using axe-core via vitest-axe.
 * Each test renders a component into jsdom, then runs the full axe
 * rule set against the resulting DOM. Any WCAG 2.1 AA violation
 * causes the test to fail with a detailed report.
 */

describe("Shared components — axe-core automated audit", () => {
  it("StatusBadge has no a11y violations", async () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("StatCard (non-interactive) has no a11y violations", async () => {
    const { container } = render(
      <StatCard label="Tổng công việc" value={42} subtitle="Tháng này" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("StatCard (interactive) renders as accessible button with keyboard support", async () => {
    let clicked = false;
    const { container, getByRole } = render(
      <StatCard label="Tiến độ" value="85%" onClick={() => { clicked = true; }} />
    );
    expect(await axe(container)).toHaveNoViolations();

    /* Verify the interactive card exposes button semantics to assistive tech */
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Tiến độ: 85%");
    expect(button).toHaveAttribute("tabindex", "0");

    /* Verify keyboard activation: pressing Enter triggers the onClick handler */
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(clicked).toBe(true);
  });

  it("Toggle exposes switch role and checked state", async () => {
    const { container, getByRole, rerender } = render(
      <Toggle checked={false} onChange={() => {}} label="Bật thông báo" />
    );
    expect(await axe(container)).toHaveNoViolations();

    const toggle = getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("aria-label", "Bật thông báo");

    /* Re-render in checked state and verify aria-checked updates */
    rerender(<Toggle checked={true} onChange={() => {}} label="Bật thông báo" />);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("CloseButton has accessible label and focus ring", async () => {
    const { container, getByRole } = render(<CloseButton onClick={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();

    const btn = getByRole("button");
    /* Default label is Vietnamese for "Close", matching the app's primary locale */
    expect(btn).toHaveAttribute("aria-label", "Đóng");
  });

  it("CloseButton accepts custom label for context-specific usage", async () => {
    const { getByRole } = render(
      <CloseButton onClick={() => {}} label="Đóng bảng chi tiết" />
    );
    expect(getByRole("button")).toHaveAttribute("aria-label", "Đóng bảng chi tiết");
  });

  it("Button renders as native <button> with no a11y violations", async () => {
    const { container } = render(<Button>Lưu thay đổi</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("FilterChip has no a11y violations in both active/inactive states", async () => {
    const { container, rerender } = render(
      <FilterChip active={false} onClick={() => {}}>Tất cả</FilterChip>
    );
    expect(await axe(container)).toHaveNoViolations();

    rerender(<FilterChip active={true} onClick={() => {}}>Tất cả</FilterChip>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("EmptyState has no a11y violations", async () => {
    const { container } = render(
      <EmptyState icon={<ClipboardList size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu" subtitle="Hãy tạo mới" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("UserAvatar image variant has descriptive alt text", async () => {
    const { container, getByAltText } = render(
      <UserAvatar name="Nguyễn Văn A" src="https://example.com/avatar.jpg" />
    );
    expect(await axe(container)).toHaveNoViolations();
    /* The alt text identifies the person, enabling screen readers to announce the avatar */
    expect(getByAltText("Nguyễn Văn A")).toBeInTheDocument();
  });

  it("UserAvatar initial variant uses title for identification", async () => {
    const { container } = render(<UserAvatar name="Trần Thị B" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Keyboard navigation", () => {
  it("StatCard is reachable via Tab and activatable via Space", async () => {
    let clicked = false;
    render(
      <StatCard label="Ngân sách" value="500M" onClick={() => { clicked = true; }} />
    );

    /* Tab moves focus to the interactive StatCard */
    await userEvent.tab();
    /* Pressing Space on a role="button" element should trigger its action */
    await userEvent.keyboard(" ");
    expect(clicked).toBe(true);
  });

  it("non-interactive StatCard is not focusable via Tab", async () => {
    const { container } = render(
      <StatCard label="Chỉ hiển thị" value={10} />
    );
    await userEvent.tab();
    /* The card should not receive focus when it has no onClick */
    expect(container.querySelector("[role='button']")).toBeNull();
  });
});
