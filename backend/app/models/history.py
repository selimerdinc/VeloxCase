from app.extensions import db


class History(db.Model):
    __tablename__ = 'history'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20))
    task = db.Column(db.String(50))
    repo_id = db.Column(db.Integer)
    folder_id = db.Column(db.Integer)
    cases_count = db.Column(db.Integer)
    images_count = db.Column(db.Integer)
    status = db.Column(db.String(20))
    case_name = db.Column(db.String(255))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    user = db.relationship('User', backref=db.backref('history', lazy='dynamic'))