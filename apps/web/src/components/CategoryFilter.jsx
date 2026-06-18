import { useEffect, useMemo, useRef, useState } from "react";

export function CategoryFilter({ categories, value, selectedLabel = "", onChange, allowAll = true }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const activeCategory = categories.find((category) => category.id === value);
  const groupedCategories = useMemo(() => {
    const groups = [];
    const indexByLevel1 = new Map();

    for (const category of categories) {
      const [fallbackLevel1, fallbackLevel2 = "全部"] = String(category.name || "").split("/");
      const level1 = category.level1 || fallbackLevel1 || "未分组";
      const level2 = category.level2 || fallbackLevel2 || category.name;

      if (!indexByLevel1.has(level1)) {
        indexByLevel1.set(level1, groups.length);
        groups.push({ level1, items: [] });
      }

      groups[indexByLevel1.get(level1)].items.push({
        ...category,
        level1,
        level2
      });
    }

    return groups;
  }, [categories]);
  const initialGroup =
    groupedCategories.find((group) => group.items.some((category) => category.id === value)) ||
    groupedCategories[0] ||
    null;
  const [activeLevel1, setActiveLevel1] = useState(initialGroup?.level1 || "");
  const activeGroup = groupedCategories.find((group) => group.level1 === activeLevel1) || groupedCategories[0];

  useEffect(() => {
    const matchedGroup = groupedCategories.find((group) => group.items.some((category) => category.id === value));
    if (matchedGroup && !open) {
      setActiveLevel1(matchedGroup.level1);
    }
  }, [groupedCategories, value]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  function handleToggle() {
    setOpen((current) => {
      const nextOpen = !current;
      if (nextOpen && initialGroup) {
        setActiveLevel1(initialGroup.level1);
      }
      return nextOpen;
    });
  }

  return (
    <div className="filter-field category-filter" ref={containerRef}>
      <span>行业类目</span>
      <button type="button" className={open ? "category-cascader-trigger active" : "category-cascader-trigger"} onClick={handleToggle}>
        <span>{activeCategory?.name || selectedLabel || (allowAll ? "全部可见类目" : "请选择类目")}</span>
        <i>⌄</i>
      </button>

      {open ? (
        <div className="category-cascader-panel">
          {allowAll ? (
            <button type="button" className={!value ? "category-cascader-all active" : "category-cascader-all"} onClick={() => handleSelect("")}>
              全部可见类目
            </button>
          ) : null}
          <div className="category-cascader-columns">
            <div className="category-cascader-col level-one">
              {groupedCategories.map((group) => (
                <button
                  type="button"
                  key={group.level1}
                  className={group.level1 === activeGroup?.level1 ? "category-cascader-item active" : "category-cascader-item"}
                  onMouseEnter={() => setActiveLevel1(group.level1)}
                  onClick={() => setActiveLevel1(group.level1)}
                >
                  <span>{group.level1}</span>
                  <b>›</b>
                </button>
              ))}
            </div>
            <div className="category-cascader-col level-two">
              {(activeGroup?.items || []).map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={category.id === value ? "category-cascader-item active" : "category-cascader-item"}
                  onClick={() => handleSelect(category.id)}
                >
                  <span>{category.level2}</span>
                  {category.hasData ? <em>有数据</em> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
