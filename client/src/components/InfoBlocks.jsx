function InfoBlock({ item }) {
  if (!item) return null;
  return (
    <div className="info-block">
      <h3 className="info-block__title">
        <span className="info-block__icon" aria-hidden="true">
          {item.icon}
        </span>
        {item.title}
      </h3>
      <div className="info-block__body">{item.body}</div>
    </div>
  );
}

export default function InfoBlocks({ items }) {
  return (
    <section className="info-blocks">
      <div className="info-blocks__grid">
        {items.map((item, index) => (
          <InfoBlock item={item} key={item.title ?? index} />
        ))}
      </div>
    </section>
  );
}
